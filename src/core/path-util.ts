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
 * Relative markdown link from a folder to a file: "./x.md" inside the
 * folder, "../x.md" one level up (DESIGN.md 5.6 — notes in subfolders
 * point at the index page with ../ forms).
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
  const prefix = ups === 0 ? ["."] : Array<string>(ups).fill("..");
  return [...prefix, ...toParts.slice(common)].join("/");
}
