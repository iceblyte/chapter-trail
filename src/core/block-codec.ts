/**
 * Marker-block codec (DESIGN.md §4.5) — the single source of truth for
 * reading, writing, and stripping both marker flavors:
 *
 *   index block:  <!-- chapter-trail:begin --> … <!-- chapter-trail:end -->
 *   nav wrappers: <!-- chapter-trail:nav-begin --> … <!-- chapter-trail:nav-end -->
 *
 * Everything is line-anchored (a stray mention inside a sentence never
 * matches), works on char offsets so content outside the block stays
 * byte-identical, and tolerates a damaged block (begin without end) by
 * treating it as extend-to-next-begin-or-EOF for repair.
 */
import { INDEX_BLOCK_BEGIN, INDEX_BLOCK_END, NAV_BLOCK_BEGIN, NAV_BLOCK_END } from "../constants";
import { detectEol, frontmatterBodyOffset } from "./text-util";

export interface BlockMatch {
  /** offset of the begin-marker line start */
  start: number;
  /** offset after the end-marker line's trailing newline (or EOF) */
  end: number;
  /** content strictly between the two marker lines */
  inner: string;
  /** begin marker present without a matching end marker */
  damaged: boolean;
}

/** Locate the next line consisting solely of `marker` (± whitespace). */
function findMarkerLine(
  text: string,
  marker: string,
  from: number,
): { lineStart: number; lineEnd: number } | null {
  let pos = Math.max(0, from);
  while (pos <= text.length) {
    const nl = text.indexOf("\n", pos);
    const lineEnd = nl === -1 ? text.length : nl;
    let contentEnd = lineEnd;
    if (contentEnd > pos && text[contentEnd - 1] === "\r") contentEnd -= 1;
    if (text.slice(pos, contentEnd).trim() === marker) {
      return { lineStart: pos, lineEnd: nl === -1 ? text.length : nl + 1 };
    }
    if (nl === -1) return null;
    pos = nl + 1;
  }
  return null;
}

function findBlock(text: string, begin: string, end: string, searchFrom = 0): BlockMatch | null {
  const beginLine = findMarkerLine(text, begin, searchFrom);
  if (!beginLine) return null;

  const endLine = findMarkerLine(text, end, beginLine.lineEnd);
  if (endLine) {
    return {
      start: beginLine.lineStart,
      end: endLine.lineEnd,
      inner: text.slice(beginLine.lineEnd, endLine.lineStart),
      damaged: false,
    };
  }

  // damaged: run to the next begin marker, else EOF
  const nextBegin = findMarkerLine(text, begin, beginLine.lineEnd);
  const stop = nextBegin ? nextBegin.lineStart : text.length;
  return {
    start: beginLine.lineStart,
    end: stop,
    inner: text.slice(beginLine.lineEnd, stop),
    damaged: true,
  };
}

/* ---------------- index block ---------------- */

export function findIndexBlock(text: string): BlockMatch | null {
  return findBlock(text, INDEX_BLOCK_BEGIN, INDEX_BLOCK_END);
}

export function hasIndexBlock(text: string): boolean {
  return findMarkerLine(text, INDEX_BLOCK_BEGIN, 0) !== null;
}

/** Remove the index block entirely (demote-to-note conflict resolution). */
export function removeIndexBlock(text: string): string {
  const existing = findIndexBlock(text);
  if (!existing) return text;
  return text.slice(0, existing.start) + text.slice(existing.end);
}

/**
 * Replace the index block's inner content (or insert a fresh block right
 * after the frontmatter when absent / damaged). Content outside the
 * replaced range is byte-identical.
 */
export function writeIndexBlock(text: string, newInner: string): string {
  const eol = detectEol(text);
  const inner = newInner.replace(/\r?\n+$/, "");
  const existing = findIndexBlock(text);
  if (existing) {
    const hadTrailingNewline = /\r?\n$/.test(text.slice(existing.start, existing.end));
    const replacement = `${INDEX_BLOCK_BEGIN}${eol}${inner}${eol}${INDEX_BLOCK_END}${hadTrailingNewline ? eol : ""}`;
    return text.slice(0, existing.start) + replacement + text.slice(existing.end);
  }
  const at = frontmatterBodyOffset(text);
  const block = `${INDEX_BLOCK_BEGIN}${eol}${inner}${eol}${INDEX_BLOCK_END}${eol}`;
  return text.slice(0, at) + block + text.slice(at);
}

/* ---------------- nav wrappers ---------------- */

export function findNavBlocks(text: string): BlockMatch[] {
  const blocks: BlockMatch[] = [];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const block = findBlock(text, NAV_BLOCK_BEGIN, NAV_BLOCK_END, searchFrom);
    if (!block) break;
    blocks.push(block);
    searchFrom = block.end;
  }
  return blocks;
}

export function hasNavBlocks(text: string): boolean {
  return findNavBlocks(text).length > 0;
}

/**
 * Remove every nav wrapper block. Only the block's own lines go away —
 * the newline that separates neighbors stays with them — so a stripped
 * file returns to its pre-injection shape (A3: zero residue).
 */
export function stripNavBlocks(text: string): { text: string; removed: boolean } {
  const blocks = findNavBlocks(text);
  if (blocks.length === 0) return { text, removed: false };
  let result = text;
  for (const block of [...blocks].reverse()) {
    result = result.slice(0, block.start) + result.slice(block.end);
  }
  return { text: result, removed: true };
}

/** Build a fresh nav wrapper block ending with a newline. */
export function navBlockText(calloutLine: string, eol: "\n" | "\r\n" = "\n"): string {
  return `${NAV_BLOCK_BEGIN}${eol}${calloutLine}${eol}${NAV_BLOCK_END}${eol}`;
}

/**
 * Canonical nav state: strip any existing wrappers, then write the top
 * block right after the frontmatter and the bottom block at end of file
 * (identical content, PRD §2.6).
 */
export function writeNavBlocks(text: string, calloutLine: string): string {
  const body = stripNavBlocks(text).text;
  const eol = detectEol(body);
  const block = navBlockText(calloutLine, eol);

  const at = frontmatterBodyOffset(body);
  const withTop = body.slice(0, at) + block + body.slice(at);
  // an empty body gets a single block that serves as both top and bottom
  if (withTop.slice(at + block.length).trim() === "") return withTop;
  const endsWithNewline = /(\r?\n)$/.test(withTop);
  return endsWithNewline ? withTop + block : withTop + eol + block;
}
