/**
 * DomainResolver — builds the vault Registry from a file snapshot
 * (DESIGN.md §4.2). "Marked means managed": a folder is a domain iff it
 * holds an .md whose frontmatter has is-index: true AND whose body
 * contains the plugin marker block.
 *
 * The resolver is pure computation plus the few body reads needed to
 * verify candidates; the status colors it computes are structural (red
 * broken links / conflicts, blue pending, yellow ties / tight gaps).
 * Event-driven staleness is layered on top by the registry store.
 */
import { PLUGIN_KEYS } from "../constants";
import type {
  DomainMode,
  DomainStatus,
  FileMeta,
  ManagedDomain,
  OrderEntry,
  Registry,
  UnmanagedFolder,
  VaultPath,
} from "../types";
import { emptyRegistry, emptyStatus } from "../types";
import { findIndexBlock } from "./block-codec";
import { type DateReadOptions, DEFAULT_DATE_OPTIONS, readEntryDates } from "./date-value";
import {
  folderName,
  isUnder,
  normalizeFolderRef,
  noteTitle,
  parentOf,
  relativeInside,
} from "./path-util";
import { basename, detectTightGaps, orderValue, sortChain } from "./sort-core";

export interface VaultSnapshot {
  files: FileMeta[];
  /** all folder paths — lets EMPTY subfolders appear in the unmanaged
   *  trail; optional so lightweight test snapshots can omit it */
  folders?: readonly VaultPath[] | undefined;
  /** read a file body — only index-page candidates trigger this */
  readFileBody(path: VaultPath): Promise<string>;
}

/** options for one registry build (date property names + display format) */
export interface RegistryOptions {
  dates: DateReadOptions;
}

export const DEFAULT_REGISTRY_OPTIONS: RegistryOptions = { dates: DEFAULT_DATE_OPTIONS };

interface IndexPage {
  path: VaultPath;
  folder: VaultPath;
  mode: DomainMode;
  excludedFolders: string[];
  body: string;
}

const LINK_TARGET = /\]\(([^)]+)\)/g;

const nameCollator = new Intl.Collator("zh", { numeric: true });

/** Build the complete registry (startup scan / full recompute). */
export async function buildRegistry(
  snap: VaultSnapshot,
  options: RegistryOptions = DEFAULT_REGISTRY_OPTIONS,
): Promise<Registry> {
  const registry = emptyRegistry();
  const files = snap.files;
  const fileSet = new Set(files.map((file) => file.path));
  const metaByPath = new Map(files.map((file) => [file.path, file] as const));

  /* 1. verify index-page candidates by reading their bodies */
  const verified: IndexPage[] = [];
  for (const file of files) {
    if (file.frontmatter?.[PLUGIN_KEYS.isIndex] !== true) continue;
    let body = "";
    try {
      body = await snap.readFileBody(file.path);
    } catch {
      body = "";
    }
    if (!findIndexBlock(body)) continue; // is-index without marker = ordinary note
    const folder = parentOf(file.path);
    if (folder === null) continue;
    verified.push({
      path: file.path,
      folder,
      mode: coerceMode(file.frontmatter?.[PLUGIN_KEYS.mode]),
      excludedFolders: coerceFolderList(file.frontmatter?.[PLUGIN_KEYS.excludedFolders]),
      body,
    });
  }

  /* 2. structural anomalies: vault-root pages + duplicate index pages */
  const byFolder = new Map<VaultPath, IndexPage[]>();
  for (const page of verified) {
    if (page.folder === "") {
      registry.orphans.push(page.path); // vault root can never be a domain (v1)
      continue;
    }
    const list = byFolder.get(page.folder);
    if (list) list.push(page);
    else byFolder.set(page.folder, [page]);
  }
  const domainPages: IndexPage[] = [];
  for (const pages of byFolder.values()) {
    if (pages.length === 1 && pages[0]) domainPages.push(pages[0]);
    // duplicates: no domain until the user keeps exactly one
    else for (const page of pages) registry.orphans.push(page.path);
  }

  const domainRoots = new Set(domainPages.map((page) => page.folder));
  const indexPathByRoot = new Map(domainPages.map((page) => [page.folder, page.path] as const));

  /* 3. compute entries per domain */
  for (const page of domainPages) {
    registry.domains.set(
      page.folder,
      buildDomain(
        page,
        {
          fileSet,
          folders: snap.folders,
          metaByPath,
          domainRoots,
          indexPathByRoot,
          allIndexPaths: new Set(verified.map((v) => v.path)),
        },
        options.dates,
      ),
    );
  }

  /* 4. series nesting conflicts (excluded subtrees do not conflict) */
  for (const page of domainPages) {
    if (page.mode !== "series") continue;
    const domain = registry.domains.get(page.folder);
    if (!domain) continue;
    const excluded = new Set(page.excludedFolders.map(normalizeFolderRef).filter(Boolean));
    for (const other of domainPages) {
      if (other.folder === page.folder || !isUnder(other.folder, page.folder)) continue;
      const rel = relativeInside(other.folder, page.folder);
      if (rel === null || isInsideExcluded(rel, excluded)) continue;
      domain.status.conflicts.push({ kind: "nested-index", path: other.path });
    }
  }

  /* 5. broken links inside index blocks */
  for (const domain of registry.domains.values()) {
    const page = domainPages.find((p) => p.folder === domain.root);
    if (!page) continue;
    const block = findIndexBlock(page.body);
    if (!block) continue;
    for (const match of block.inner.matchAll(LINK_TARGET)) {
      const target = resolveRelative(domain.root, match[1] ?? "");
      if (target && !fileSet.has(target)) domain.status.broken.push(target);
    }
  }

  /* 6. vault-level legacy orders: files with order outside every domain */
  const inAnyDomain = new Set<VaultPath>();
  for (const domain of registry.domains.values()) {
    for (const entry of domain.entries) if (entry.kind === "file") inAnyDomain.add(entry.path);
    inAnyDomain.add(domain.indexPath);
  }
  for (const file of files) {
    if (inAnyDomain.has(file.path)) continue;
    if (orderValue(file.frontmatter?.[PLUGIN_KEYS.order]) === undefined) continue;
    if (file.frontmatter?.[PLUGIN_KEYS.isIndex] === true) continue;
    const folder = parentOf(file.path);
    if (folder === null || folder === "") continue;
    const list = registry.legacyOrders.get(folder) ?? [];
    list.push(file.path);
    registry.legacyOrders.set(folder, list);
  }

  return registry;
}

interface BuildContext {
  fileSet: Set<VaultPath>;
  folders: readonly VaultPath[] | undefined;
  metaByPath: Map<VaultPath, FileMeta>;
  domainRoots: Set<VaultPath>;
  indexPathByRoot: Map<VaultPath, VaultPath>;
  allIndexPaths: Set<VaultPath>;
}

function buildDomain(page: IndexPage, ctx: BuildContext, dates: DateReadOptions): ManagedDomain {
  const excluded = new Set(page.excludedFolders.map(normalizeFolderRef).filter(Boolean));
  const entries: OrderEntry[] = [];

  const fileIsExcluded = (meta: FileMeta | undefined, relPath: string): boolean =>
    meta?.frontmatter?.[PLUGIN_KEYS.excluded] === true || isInsideExcluded(relPath, excluded);

  const toFileEntry = (path: VaultPath): OrderEntry | null => {
    if (path === page.path) return null; // own index page never chains
    if (ctx.allIndexPaths.has(path)) return null; // other index pages neither
    const meta = ctx.metaByPath.get(path);
    if (!meta) return null;
    const rel = relativeInside(path, page.folder);
    if (rel === null || fileIsExcluded(meta, rel)) return null;
    const order = orderValue(meta.frontmatter?.[PLUGIN_KEYS.order]);
    const entryDates = readEntryDates(meta.frontmatter, dates);
    return {
      path,
      kind: "file",
      title: noteTitle(path),
      ...(order === undefined ? {} : { order }),
      ...(entryDates === undefined ? {} : { dates: entryDates }),
    };
  };

  if (page.mode === "series") {
    for (const path of ctx.fileSet) {
      if (!path.endsWith(".md") || !isUnder(path, page.folder)) continue;
      const entry = toFileEntry(path);
      if (!entry) continue;
      const parent = parentOf(path);
      const prefix =
        parent === null || parent === page.folder
          ? undefined
          : `${parent.slice(page.folder === "" ? 0 : page.folder.length + 1)}/`;
      entries.push(prefix === undefined ? entry : { ...entry, prefix });
    }
  } else {
    /* direct .md files */
    for (const path of ctx.fileSet) {
      if (!path.endsWith(".md")) continue;
      const rel = relativeInside(path, page.folder);
      if (rel === null || rel.includes("/")) continue; // direct children only
      const entry = toFileEntry(path);
      if (entry) entries.push(entry);
    }
    /* managed subfolders mix in, ordered by their own index order */
    for (const root of ctx.domainRoots) {
      if (root === page.folder || parentOf(root) !== page.folder) continue;
      const rel = relativeInside(root, page.folder);
      if (rel === null || isInsideExcluded(rel, excluded)) continue;
      const indexMeta = ctx.metaByPath.get(ctx.indexPathByRoot.get(root) ?? "");
      const order = orderValue(indexMeta?.frontmatter?.[PLUGIN_KEYS.order]);
      entries.push({
        path: root,
        kind: "managed-folder",
        title: folderName(root),
        ...(order === undefined ? {} : { order }),
      });
    }
  }

  const outcome = sortChain(entries);
  const ordered = outcome.sorted
    .map((entry) => entry.order)
    .filter((order): order is number => order !== undefined);

  const status: DomainStatus = {
    ...emptyStatus(),
    ties: outcome.ties,
    pending: outcome.pending,
    tightGap: detectTightGaps(ordered),
  };

  return {
    root: page.folder,
    mode: page.mode,
    indexPath: page.path,
    entries: outcome.sorted,
    unmanagedFolders:
      page.mode === "independent" ? collectUnmanaged(page.folder, excluded, ctx) : [],
    excludedFolders: [...excluded],
    status,
  };
}

function isInsideExcluded(relPath: string, excluded: Set<string>): boolean {
  for (const ref of excluded) {
    if (relPath === ref || relPath.startsWith(`${ref}/`)) return true;
  }
  return false;
}

function collectUnmanaged(
  root: VaultPath,
  excluded: Set<string>,
  ctx: BuildContext,
): UnmanagedFolder[] {
  const directChildren = new Set<VaultPath>();
  for (const path of ctx.fileSet) {
    if (!isUnder(path, root)) continue;
    const rel = relativeInside(path, root);
    if (!rel) continue;
    const slash = rel.indexOf("/");
    if (slash === -1) continue; // a direct file, not a folder head
    const head = rel.slice(0, slash);
    if (!head) continue;
    directChildren.add(root === "" ? head : `${root}/${head}`);
  }
  // the vault's folder list covers EMPTY folders, which carry no files
  for (const folder of ctx.folders ?? []) {
    if (parentOf(folder) !== root) continue;
    directChildren.add(folder);
  }
  const out: UnmanagedFolder[] = [];
  for (const child of directChildren) {
    const rel = relativeInside(child, root);
    if (!rel) continue;
    if (ctx.domainRoots.has(child)) continue; // managed → part of the chain
    if (excluded.has(rel)) continue;
    const files: VaultPath[] = [];
    for (const path of ctx.fileSet) {
      if (path.endsWith(".md") && isUnder(path, child)) files.push(path);
    }
    files.sort((a, b) => nameCollator.compare(basename(a), basename(b)));
    out.push({ path: child, title: folderName(child), files });
  }
  out.sort((a, b) => nameCollator.compare(basename(a.path), basename(b.path)));
  return out;
}

function coerceMode(raw: unknown): DomainMode {
  return raw === "series" ? "series" : "independent";
}

function coerceFolderList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  if (typeof raw === "string" && raw.trim() !== "") return [raw.trim()];
  return [];
}

/** Resolve a `./relative.md` link target against the index page folder. */
function resolveRelative(folder: VaultPath, target: string): VaultPath | null {
  let cleaned = target;
  try {
    cleaned = decodeURIComponent(target);
  } catch {
    cleaned = target;
  }
  if (cleaned.startsWith("/")) return null; // absolute links are not ours
  const parts = (folder === "" ? [] : folder.split("/")).concat(cleaned.split("/"));
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}
