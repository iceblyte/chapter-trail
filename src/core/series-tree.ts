/**
 * Series tree — shared by the panel tree view (EntryList) and the
 * folder block move (services). Building the chain order FROM the tree
 * (after a folder move) guarantees the panel tree, the native explorer
 * order and the chain never diverge.
 */

import type { OrderEntry, VaultPath } from "../types";

export interface SeriesTreeNode {
  /** direct child folders, keyed by name (relative to this node) */
  folders: Map<string, SeriesTreeNode>;
  /** files directly in this node, in chain order */
  files: { entry: OrderEntry; chainIndex: number }[];
}

/** build the series tree from the ordered chain (paths under domainRoot) */
export function buildSeriesTree(
  ordered: readonly OrderEntry[],
  domainRoot: string,
): SeriesTreeNode {
  const root: SeriesTreeNode = { folders: new Map(), files: [] };
  for (let chainIndex = 0; chainIndex < ordered.length; chainIndex++) {
    const entry = ordered[chainIndex];
    if (!entry) continue;
    const rel = domainRoot === "" ? entry.path : entry.path.slice(domainRoot.length + 1);
    const segments = rel.split("/");
    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const name = segments[i];
      if (!name) continue;
      let child = node.folders.get(name);
      if (!child) {
        child = { folders: new Map(), files: [] };
        node.folders.set(name, child);
      }
      node = child;
    }
    node.files.push({ entry, chainIndex });
  }
  return root;
}

/** resolve a folder node by vault path (absolute, under domainRoot) */
export function findSeriesNode(
  tree: SeriesTreeNode,
  domainRoot: string,
  folderPath: VaultPath,
): SeriesTreeNode | null {
  const rel = domainRoot === "" ? folderPath : folderPath.slice(domainRoot.length + 1);
  if (rel === "" || rel === folderPath) return null;
  let node: SeriesTreeNode = tree;
  for (const name of rel.split("/")) {
    const child = node.folders.get(name);
    if (!child) return null;
    node = child;
  }
  return node;
}

interface ChildRef {
  /** folder name or "" for a direct file */
  kind: "folder" | "file";
  name: string;
  node?: SeriesTreeNode;
  file?: { entry: OrderEntry; chainIndex: number };
  /** chain index of the child's first appearance */
  firstIndex: number;
}

/** children of a node sorted by first appearance in the chain */
function childrenByFirstAppearance(node: SeriesTreeNode): ChildRef[] {
  const children: ChildRef[] = [];
  for (const [name, child] of node.folders) {
    const indices: number[] = [];
    collectIndices(child, indices);
    children.push({
      kind: "folder",
      name,
      node: child,
      firstIndex: indices.length > 0 ? Math.min(...indices) : Number.MAX_SAFE_INTEGER,
    });
  }
  for (const file of node.files) {
    children.push({ kind: "file", name: "", file, firstIndex: file.chainIndex });
  }
  children.sort((a, b) => a.firstIndex - b.firstIndex);
  return children;
}

function collectIndices(node: SeriesTreeNode, out: number[]): void {
  for (const file of node.files) out.push(file.chainIndex);
  for (const child of node.folders.values()) collectIndices(child, out);
}

/**
 * Flatten a tree back into chain order (files only). This IS the order
 * the tree displays, so the native explorer and the panel tree can
 * never diverge from the chain.
 */
export function flattenSeriesTree(node: SeriesTreeNode): OrderEntry[] {
  const out: OrderEntry[] = [];
  const walk = (node: SeriesTreeNode): void => {
    for (const child of childrenByFirstAppearance(node)) {
      if (child.kind === "folder" && child.node) walk(child.node);
      else if (child.file) out.push(child.file.entry);
    }
  };
  walk(node);
  return out;
}

/** remove a folder node (by vault path) from the tree, returning it */
export function detachSeriesNode(
  tree: SeriesTreeNode,
  domainRoot: string,
  folderPath: VaultPath,
): SeriesTreeNode | null {
  const rel = domainRoot === "" ? folderPath : folderPath.slice(domainRoot.length + 1);
  const segments = rel.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  let node: SeriesTreeNode = tree;
  for (let i = 0; i < segments.length - 1; i++) {
    const child = node.folders.get(segments[i] ?? "");
    if (!child) return null;
    node = child;
  }
  const name = segments[segments.length - 1] ?? "";
  const detached = node.folders.get(name);
  if (!detached) return null;
  node.folders.delete(name);
  return detached;
}
