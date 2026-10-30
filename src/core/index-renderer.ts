/**
 * IndexRenderer — renders the marker-block inner content for both modes
 * (DESIGN.md §4.6). Golden-file tested: the output format is the plugin's
 * public contract with Quartz (raw relative markdown links per the
 * confirmed prototype baseline).
 *
 * Bug 10: an independent domain's index now nests a managed subdomain's
 * WHOLE list under the subfolder link (indented, same chain order), not
 * just the subfolder link itself.
 */
import type { DateDisplay, ManagedDomain, OrderEntry, Registry, VaultPath } from "../types";
import { encodeLinkPath, relativeInside } from "./path-util";

export interface RenderOptions {
  dateDisplay: DateDisplay;
}

/** Render one domain's index block content (list only, no markers). */
export function renderIndexInner(
  domain: ManagedDomain,
  registry: Registry,
  opts: RenderOptions,
): string {
  if (domain.mode === "series") {
    const lines: string[] = [];
    emitSeriesEntries(domain, domain.root, opts, lines, 0);
    return `${lines.join("\n")}\n`;
  }
  const lines: string[] = [];
  renderIndependentChain(domain, registry, opts, domain.root, lines, 0);
  return `${lines.join("\n")}\n`;
}

/**
 * Independent chain: direct files, managed subfolders (each nesting its
 * subdomain's full list) and unmanaged folders trailing as plain text.
 * `linkRoot` is the folder of the index page being rendered — every
 * link resolves against it, at any nesting depth.
 */
function renderIndependentChain(
  domain: ManagedDomain,
  registry: Registry,
  opts: RenderOptions,
  linkRoot: VaultPath,
  lines: string[],
  depth: number,
): void {
  for (const entry of domain.entries) {
    if (entry.kind === "managed-folder") {
      renderManagedFolder(entry, registry, opts, linkRoot, lines, depth);
      continue;
    }
    lines.push(`${indent(depth)}${renderLeaf(entry, linkRoot, opts)}`);
  }
  for (const folder of domain.unmanagedFolders) {
    lines.push(`${indent(depth)}- ${folder.title}`);
  }
}

/** subfolder link line + the subdomain's entries nested underneath */
function renderManagedFolder(
  entry: OrderEntry,
  registry: Registry,
  opts: RenderOptions,
  linkRoot: VaultPath,
  lines: string[],
  depth: number,
): void {
  const child = registry.domains.get(entry.path);
  const linkPath = child ? relativeInside(child.indexPath, linkRoot) : null;
  lines.push(
    `${indent(depth)}${linkPath ? `- [${entry.title}](${encodeLinkPath(linkPath)})` : `- ${entry.title}`}`,
  );
  if (!child) return;
  if (child.mode === "series") {
    // one chain across the child's subtree → indented tree
    emitSeriesEntries(child, linkRoot, opts, lines, depth + 1);
  } else {
    renderIndependentChain(child, registry, opts, linkRoot, lines, depth + 1);
  }
}

function renderLeaf(entry: OrderEntry, root: VaultPath, opts: RenderOptions): string {
  const rel = relativeInside(entry.path, root);
  if (rel === null) return `- ${entry.title}`;
  const date = formatDates(entry, opts.dateDisplay);
  return `- [${entry.title}](${encodeLinkPath(rel)})${date ? ` ${date}` : ""}`;
}

function formatDates(entry: OrderEntry, mode: DateDisplay): string {
  const dates = entry.dates;
  if (!dates) return "";
  if (mode === "created") return dates.created ?? "";
  if (mode === "updated") return dates.updated ?? "";
  const parts: string[] = [];
  if (dates.created) parts.push(dates.created);
  if (dates.updated) parts.push(dates.updated);
  if (parts.length === 2) return `${parts[0]} → ${parts[1]}`;
  return parts[0] ?? "";
}

/* ---------------- series tree ---------------- */

type TreeChild =
  | { type: "folder"; name: string; node: TreeNode }
  | { type: "file"; entry: OrderEntry };

interface TreeNode {
  /** children in first-appearance order along the chain */
  children: TreeChild[];
  folders: Map<string, TreeNode>;
}

/**
 * Emit a series domain's chain as an indented tree: intermediate
 * folders become plain bold nodes at first appearance, leaves are
 * standard links resolving against `linkRoot`.
 */
function emitSeriesEntries(
  domain: ManagedDomain,
  linkRoot: VaultPath,
  opts: RenderOptions,
  lines: string[],
  depth: number,
): void {
  const root: TreeNode = { children: [], folders: new Map() };
  for (const entry of domain.entries) {
    if (entry.kind !== "file") continue;
    const rel = relativeInside(entry.path, domain.root);
    if (rel === null) continue;
    const segments = rel.split("/");
    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const name = segments[i];
      if (!name) continue;
      let child = node.folders.get(name);
      if (!child) {
        child = { children: [], folders: new Map() };
        node.folders.set(name, child);
        node.children.push({ type: "folder", name, node: child });
      }
      node = child;
    }
    node.children.push({ type: "file", entry });
  }
  emitTree(root, linkRoot, opts, lines, depth);
}

function emitTree(
  node: TreeNode,
  linkRoot: VaultPath,
  opts: RenderOptions,
  lines: string[],
  depth: number,
): void {
  for (const child of node.children) {
    if (child.type === "folder") {
      lines.push(`${indent(depth)}- **${child.name}**`);
      emitTree(child.node, linkRoot, opts, lines, depth + 1);
    } else {
      lines.push(`${indent(depth)}${renderLeaf(child.entry, linkRoot, opts)}`);
    }
  }
}

function indent(depth: number): string {
  return " ".repeat(depth * 4);
}
