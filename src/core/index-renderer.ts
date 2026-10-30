/**
 * IndexRenderer — renders the marker-block inner content for both modes
 * (DESIGN.md §4.6). Golden-file tested: the output format is the plugin's
 * public contract with Quartz (raw relative markdown links per the
 * confirmed prototype baseline).
 *
 * Bug 10: an independent domain's index now nests a managed subdomain's
 * WHOLE list under the subfolder link (indented, same chain order), not
 * just the subfolder link itself. Entries are separated by blank lines
 * for readability; which dates render is user-configurable (default:
 * created on, updated off).
 */
import type { ManagedDomain, OrderEntry, Registry, VaultPath } from "../types";
import { encodeLinkPath, relativeInside } from "./path-util";

export interface RenderOptions {
  /** render each entry's created date */
  showCreated: boolean;
  /** render each entry's updated date */
  showUpdated: boolean;
}

/** Render one domain's index block content (list only, no markers). */
export function renderIndexInner(
  domain: ManagedDomain,
  registry: Registry,
  opts: RenderOptions,
): string {
  const lines: RenderLine[] = [];
  if (domain.mode === "series") {
    emitSeriesEntries(domain, domain.root, opts, lines, 0);
  } else {
    renderIndependentChain(domain, registry, opts, domain.root, lines, 0);
  }
  // top-level entries get a blank line between them (easy to scan);
  // nested lines hug their parent node (round 18 layout)
  let out = "";
  for (const [index, line] of lines.entries()) {
    if (index > 0) out += line.depth === 0 ? "\n\n" : "\n";
    out += line.text;
  }
  return `${out}\n`;
}

/** one rendered markdown line and its indent depth */
interface RenderLine {
  text: string;
  depth: number;
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
  lines: RenderLine[],
  depth: number,
): void {
  for (const entry of domain.entries) {
    if (entry.kind === "managed-folder") {
      renderManagedFolder(entry, registry, opts, linkRoot, lines, depth);
      continue;
    }
    lines.push({ text: `${indent(depth)}${renderLeaf(entry, linkRoot, opts)}`, depth });
  }
  for (const folder of domain.unmanagedFolders) {
    lines.push({ text: `${indent(depth)}- ${folder.title}`, depth });
  }
}

/** subfolder link line + the subdomain's entries nested underneath */
function renderManagedFolder(
  entry: OrderEntry,
  registry: Registry,
  opts: RenderOptions,
  linkRoot: VaultPath,
  lines: RenderLine[],
  depth: number,
): void {
  const child = registry.domains.get(entry.path);
  const linkPath = child ? relativeInside(child.indexPath, linkRoot) : null;
  lines.push({
    text: `${indent(depth)}${linkPath ? `- [${entry.title}](${encodeLinkPath(linkPath)})` : `- ${entry.title}`}`,
    depth,
  });
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
  const date = formatDates(entry, opts);
  return `- [${entry.title}](${encodeLinkPath(rel)})${date ? ` — ${date}` : ""}`;
}

function formatDates(entry: OrderEntry, opts: RenderOptions): string {
  const dates = entry.dates;
  if (!dates) return "";
  const parts: string[] = [];
  if (opts.showCreated && dates.created) parts.push(dates.created);
  if (opts.showUpdated && dates.updated) parts.push(dates.updated);
  if (parts.length === 0) return "";
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
  lines: RenderLine[],
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
  lines: RenderLine[],
  depth: number,
): void {
  for (const child of node.children) {
    if (child.type === "folder") {
      lines.push({ text: `${indent(depth)}- **${child.name}**`, depth });
      emitTree(child.node, linkRoot, opts, lines, depth + 1);
    } else {
      lines.push({ text: `${indent(depth)}${renderLeaf(child.entry, linkRoot, opts)}`, depth });
    }
  }
}

function indent(depth: number): string {
  return " ".repeat(depth * 4);
}
