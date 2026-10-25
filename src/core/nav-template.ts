/**
 * NavTemplate — the prev / overview / next callout content matrix
 * (PRD §2.6). The written labels are static note content (not UI i18n):
 * they must render identically in Obsidian and after a Quartz publish.
 *
 *   > [!chapter-trail]- 上一篇：[..](./..) | 总览：[..](./目录.md) | 下一篇：[..](./..)
 *
 * First entry omits 上一篇, last omits 下一篇, a single-entry chain
 * keeps only 总览; top and bottom blocks share the same line.
 */
import { CALLOUT_TYPE } from "../constants";
import type { OrderEntry, VaultPath } from "../types";
import { parentOf, relativeLink } from "./path-util";

export interface NavContext {
  /** the domain index page every 总览 slot points at */
  indexPath: VaultPath;
}

/** Build the callout line for `files[index]` (the file-only chain). */
export function calloutLine(files: readonly OrderEntry[], index: number, ctx: NavContext): string {
  const current = files[index];
  if (!current) throw new Error(`calloutLine: no chain entry at ${index}`);
  const folder = parentOf(current.path) ?? "";
  const prev = files[index - 1];
  const next = files[index + 1];

  const parts: string[] = [];
  if (prev) parts.push(`上一篇：[${prev.title}](${relativeLink(folder, prev.path)})`);
  parts.push(`总览：[${indexTitle(ctx.indexPath)}](${relativeLink(folder, ctx.indexPath)})`);
  if (next) parts.push(`下一篇：[${next.title}](${relativeLink(folder, next.path)})`);
  return `> [!${CALLOUT_TYPE}]- ${parts.join(" | ")}`;
}

/** Callout line for every chain file, keyed by vault path. */
export function calloutLines(
  chain: readonly OrderEntry[],
  ctx: NavContext,
): Map<VaultPath, string> {
  const files = chain.filter((entry) => entry.kind === "file");
  const map = new Map<VaultPath, string>();
  files.forEach((entry, index) => {
    map.set(entry.path, calloutLine(files, index, ctx));
  });
  return map;
}

function indexTitle(indexPath: VaultPath): string {
  const base = indexPath.slice(indexPath.lastIndexOf("/") + 1);
  return base.endsWith(".md") ? base.slice(0, -3) : base;
}
