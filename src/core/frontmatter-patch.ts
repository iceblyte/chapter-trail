/**
 * Surgical frontmatter editor (DESIGN.md §4.4 / §5.2).
 *
 * Pure string → string: only the plugin's own keys are ever added,
 * replaced or removed; every other line — user keys, comments, blank
 * lines, quotes, date literals — is preserved byte-for-byte. The result
 * is re-assembled with the original BOM and line endings.
 */
import { PLUGIN_KEY_SET, type PluginKey } from "../constants";

export type PatchValue = string | number | boolean | readonly string[];

export type PatchOp =
  | { op: "upsert"; key: PluginKey; value: PatchValue }
  | { op: "remove"; key: PluginKey };

export type PatchFailureReason = "no-frontmatter" | "unparseable" | "key-outside-plugin-ns";

export type PatchResult =
  | { ok: true; text: string; changed: boolean }
  | { ok: false; reason: PatchFailureReason };

export interface PatchOptions {
  /**
   * Safety valve (DESIGN.md §4.4): parse the patched frontmatter and
   * throw on failure — the adapter injects Obsidian's parseYaml. When
   * advanced YAML tokens are present the patch additionally
   * deep-compares both parses with plugin keys stripped.
   */
  parseYaml?: ((text: string) => unknown) | undefined;
}

const TOP_LEVEL_KEY = /^([A-Za-z0-9_-]+):(?:[ \t].*)?$/;
const COMMENT_LINE = /^\s*#/;
const FENCE = /^---[ \t]*$/;
const ADVANCED_TOKENS = /[&*!]|<<</;

interface LineSpan {
  /** index of the `key:` line within the full line array */
  start: number;
  /** exclusive end: next top-level key / comment / close line */
  end: number;
}

/** Serialize one plugin value to YAML source (without the key). */
export function serializeValue(value: PatchValue): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return serializeScalar(value);
  return value.length === 0
    ? "[]"
    : value.every(isSimpleFlowItem)
      ? `[${value.join(", ")}]`
      : value.map((item) => `- ${serializeScalar(item)}`).join("\n");
}

function serializeScalar(value: string): string {
  return isSimpleFlowItem(value) ? value : JSON.stringify(value);
}

function isSimpleFlowItem(value: string): boolean {
  return value !== "" && /^[\w\u4e00-\u9fff./ -]+$/.test(value);
}

function detectEol(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Locate the frontmatter and index its top-level key spans.
 * Returns null when the file has no frontmatter block.
 */
function parseFrontmatter(
  lines: string[],
): { closeLine: number; spans: Map<string, LineSpan> } | null {
  if (lines[0] === undefined || !FENCE.test(lines[0])) return null;
  let closeLine = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i] ?? "")) {
      closeLine = i;
      break;
    }
  }
  if (closeLine === -1) return null;

  // collect the first top-level `key:` line per key name
  const starts = new Map<string, number>();
  for (let i = 1; i < closeLine; i++) {
    const key = TOP_LEVEL_KEY.exec(lines[i] ?? "")?.[1];
    if (key !== undefined && !starts.has(key)) starts.set(key, i);
  }

  // span end = nearest of: next key start, comment line, close line
  const spans = new Map<string, LineSpan>();
  const orderedStarts = [...starts.entries()].sort((a, b) => a[1] - b[1]);
  for (let k = 0; k < orderedStarts.length; k++) {
    const [key, start] = orderedStarts[k] ?? ["", -1];
    if (start === -1) continue;
    const nextStart = orderedStarts[k + 1]?.[1] ?? closeLine;
    let end = nextStart;
    for (let i = start + 1; i < end; i++) {
      if (COMMENT_LINE.test(lines[i] ?? "")) {
        end = i;
        break;
      }
    }
    spans.set(key, { start, end });
  }
  return { closeLine, spans };
}

/** Apply plugin-key-only edits to raw note text. */
export function patchFrontmatter(
  raw: string,
  edits: readonly PatchOp[],
  options?: PatchOptions,
): PatchResult {
  for (const edit of edits) {
    if (!PLUGIN_KEY_SET.has(edit.key)) return { ok: false, reason: "key-outside-plugin-ns" };
  }

  const bom = raw.startsWith("\uFEFF") ? "\uFEFF" : "";
  const body = bom ? raw.slice(1) : raw;
  const eol = detectEol(body);
  const lines = body.split(/\r?\n/);
  const block = parseFrontmatter(lines);

  if (!block) {
    if (edits.some((edit) => edit.op === "remove")) {
      return { ok: false, reason: "no-frontmatter" };
    }
    const rows = edits
      .filter((edit): edit is Extract<PatchOp, { op: "upsert" }> => edit.op === "upsert")
      .flatMap((edit) => `${edit.key}: ${serializeValue(edit.value)}`.split(/\r?\n/));
    const next = `${bom}---${eol}${rows.join(eol)}${eol}---${eol}${body}`;
    return { ok: true, text: next, changed: next !== raw };
  }

  const fmLines = lines.slice(1, block.closeLine);
  const afterFm = lines.slice(block.closeLine + 1);
  const nextFm = applyEdits(fmLines, block.spans, edits);
  if (!nextFm) return { ok: false, reason: "unparseable" };

  if (options?.parseYaml) {
    const oldText = fmLines.join(eol);
    const newText = nextFm.join(eol);
    if (!validateYaml(options.parseYaml, oldText, newText)) {
      return { ok: false, reason: "unparseable" };
    }
  }

  const tail = afterFm.length > 0 ? eol + afterFm.join(eol) : "";
  const next = `${bom}---${eol}${nextFm.join(eol)}${eol}---${tail}`;
  return { ok: true, text: next, changed: next !== raw };
}

function applyEdits(
  fmLines: string[],
  spans: Map<string, LineSpan>,
  edits: readonly PatchOp[],
): string[] | null {
  const result = [...fmLines];

  // splice existing spans bottom-up so earlier indices stay valid
  const existing = edits
    .map((edit) => ({ edit, span: spans.get(edit.key) }))
    .filter((item): item is { edit: PatchOp; span: LineSpan } => item.span !== undefined)
    .sort((a, b) => b.span.start - a.span.start);
  for (const { edit, span } of existing) {
    const offset = 1; // fmLines starts after the opening `---`
    if (edit.op === "remove") {
      result.splice(span.start - offset, span.end - span.start);
    } else {
      const serialized = `${edit.key}: ${serializeValue(edit.value)}`;
      result.splice(span.start - offset, span.end - span.start, ...serialized.split(/\r?\n/));
    }
  }

  // append missing keys afterwards, in caller order
  for (const edit of edits) {
    if (edit.op !== "upsert" || spans.has(edit.key)) continue;
    result.push(`${edit.key}: ${serializeValue(edit.value)}`);
  }
  return result;
}

function validateYaml(
  parseYaml: (text: string) => unknown,
  oldText: string,
  newText: string,
): boolean {
  let after: unknown;
  try {
    after = parseYaml(newText);
  } catch {
    return false;
  }
  if (after === null || after === undefined) return true; // empty frontmatter is valid
  if (!ADVANCED_TOKENS.test(oldText) && !ADVANCED_TOKENS.test(newText)) return true;

  let before: unknown;
  try {
    before = parseYaml(oldText);
  } catch {
    return false;
  }
  return deepEqual(stripPluginKeys(before), stripPluginKeys(after));
}

function stripPluginKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const record = { ...(value as Record<string, unknown>) };
  for (const key of PLUGIN_KEY_SET) delete record[key];
  return record;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
