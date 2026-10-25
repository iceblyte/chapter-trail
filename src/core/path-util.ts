/**
 * Path helpers — everything is vault-relative, POSIX separators ("/"),
 * never starting with "/" (the vault root folder is the empty string).
 */
import type { VaultPath } from "../types";

/** Parent folder of a file/folder path; "" for top-level, null for root input. */
export function parentOf(path: VaultPath): VaultPath | null {
  const slash = path.lastIndexOf("/");
  if (slash === -1) return "";
  return slash === 0 ? null : path.slice(0, slash);
}

/** Path is strictly inside `folder` (folder itself excluded). */
export function isUnder(path: VaultPath, folder: VaultPath): boolean {
  if (folder === "") return path.includes("/");
  return path.length > folder.length + 1 && path.startsWith(`${folder}/`);
}

/** Join folder and name with "/" (folder may be "" for top level). */
export function joinPath(folder: VaultPath, name: string): VaultPath {
  return folder === "" ? name : `${folder}/${name}`;
}

/** File name without directory and without the .md extension. */
export function noteTitle(path: VaultPath): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.endsWith(".md") ? base.slice(0, -3) : base;
}

/** Folder name without directory (the last path segment). */
export function folderName(folder: VaultPath): string {
  return folder.slice(folder.lastIndexOf("/") + 1);
}

/** Path of `path` relative to `root` (both folders); null when not inside. */
export function relativeInside(path: VaultPath, root: VaultPath): string | null {
  if (root === "") return path.includes("/") ? path : null;
  if (!path.startsWith(`${root}/`)) return null;
  return path.slice(root.length + 1);
}

/** Normalize an excluded-folders entry: no leading/trailing slashes. */
export function normalizeFolderRef(ref: string): string {
  return ref.replace(/^\/+|\/+$/g, "").trim();
}

/**
 * Characters that break markdown links or URI parsing when they appear
 * raw in a link target. Everything else — CJK included — stays as-is,
 * matching the user-confirmed format (spaces → %20 etc.).
 */
const LINK_UNSAFE = /[\s()<>[\]{}"'#%&+,;=\\^`|?:@]/g;

/** Percent-encode a vault path for use inside a markdown link. */
export function encodeLinkPath(path: VaultPath): string {
  return path.replace(LINK_UNSAFE, (char) =>
    [...new TextEncoder().encode(char)]
      .map((byte) => `%${byte.toString(16).toUpperCase()}`)
      .join(""),
  );
}

/**
 * Relative markdown link from a folder to a file: a bare relative path
 * ("x.md", "sub/x.md") inside the folder and "../x.md" forms upward
 * (DESIGN.md 5.6). No "./" prefix; unsafe characters percent-encoded.
 */
export function relativeLink(fromFolder: VaultPath, toFile: VaultPath): string {
  const fromParts = fromFolder === "" ? [] : fromFolder.split("/");
  const toParts = toFile.split("/");
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length - 1 &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }
  const ups = fromParts.length - common;
  const prefix = Array<string>(ups).fill("..");
  return encodeLinkPath([...prefix, ...toParts.slice(common)].join("/"));
}
