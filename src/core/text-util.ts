/**
 * Line-ending-aware text helpers shared by the codecs. All offsets are
 * char offsets into the raw string; EOL style is detected once and
 * reused for anything the plugin writes.
 */

export function detectEol(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

const OPEN_FENCE = /^---[ \t]*(\r?\n)/;
const FENCE_LINE = /^---[ \t]*$/;

/**
 * Offset where the body starts: right after the frontmatter's closing
 * `---` line (including its newline). 0 when there is no frontmatter.
 */
export function frontmatterBodyOffset(text: string): number {
  const open = OPEN_FENCE.exec(text);
  if (!open) return 0;
  let search = open[0].length;
  while (search <= text.length) {
    const nl = text.indexOf("\n", search);
    const lineEnd = nl === -1 ? text.length : nl;
    const line = text.slice(search, lineEnd).replace(/\r$/, "");
    if (FENCE_LINE.test(line)) {
      return Math.min(text.length, lineEnd + 1);
    }
    if (nl === -1) break;
    search = nl + 1;
  }
  return 0;
}
