/**
 * IndexRenderer — renders the marker-block inner content for both modes
 * (DESIGN.md §4.6). Golden-file tested: the output format is the plugin's
 * public contract with Quartz (raw relative markdown links per the
 * confirmed prototype baseline).
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
    return renderSeriesTree(domain, opts);
  }

  const lines: string[] = [];
  for (const entry of domain.entries) {
    if (entry.kind === "managed-folder") {
      const child = registry.domains.get(entry.path);
      const linkPath = child ? relativeInside(child.indexPath, domain.root) : null;
      lines.push(linkPath ? `- [${entry.title}](${encodeLinkPath(linkPath)})` : `- ${entry.title}`);
      continue;
    }
    lines.push(renderLeaf(entry, domain.root, opts));
  }
  /* independent: unmanaged folders trail as plain text, name-sorted */
  for (const folder of domain.unmanagedFolders) {
    lines.push(`- ${folder.title}`);
  }
  return `${lines.join("\n")}\n`;
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

function renderSeriesTree(domain: ManagedDomain, opts: RenderOptions): string {
  const root: TreeNode = { children: [], folders: new Map() };
  for (const entry of domain.entries) {
    if (entry.kind !== "file") continue;
    const rel = relativeInside(entry.path, domain.root);
    if (rel === null) continue;
    const segments = rel.split("/");
    let node = root;
    // intermediate folders become plain bold nodes at first appearance
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
  const lines: string[] = [];
  emitTree(root, domain, opts, lines, 0);
  return `${lines.join("\n")}\n`;
}

function emitTree(
  node: TreeNode,
  domain: ManagedDomain,
  opts: RenderOptions,
  lines: string[],
  depth: number,
): void {
  for (const child of node.children) {
    if (child.type === "folder") {
      lines.push(`${indent(depth)}- **${child.name}**`);
      emitTree(child.node, domain, opts, lines, depth + 1);
    } else {
      lines.push(`${indent(depth)}${renderLeaf(child.entry, domain.root, opts)}`);
    }
  }
}

function indent(depth: number): string {
  return " ".repeat(depth * 4);
}
