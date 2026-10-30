/**
 * created / updated date reading for cards and index pages.
 *
 * Accepts every shape authors actually keep in frontmatter: Obsidian
 * date/datetime properties (with "T" or a space separator), plain ISO
 * text, `YYYY/MM/DD`, the `[[...]]` wrapped form, trailing timezone
 * offsets, YAML Date objects (js-yaml timestamp coercion) and epoch
 * numbers. Everything else fails → the entry shows no date.
 *
 * Display is formatted with moment-style tokens (the same vocabulary the
 * "Update modified date" community plugin uses for its Date format
 * setting). A value without a time part never grows one: "2026-08-28"
 * stays "2026-08-28" under the default "YYYY-MM-DD HH:mm" format.
 * No timezone math ever happens — these dates are pure display semantics.
 */

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  hasTime: boolean;
}

export interface DateReadOptions {
  /** frontmatter key read as the created date; "" disables created */
  createdKey: string;
  /** frontmatter key read as the updated date; "" disables updated */
  updatedKey: string;
  /** moment-style display format (YYYY YY MM DD HH mm ss) */
  format: string;
}

export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD HH:mm";

export const DEFAULT_DATE_OPTIONS: DateReadOptions = {
  createdKey: "created",
  updatedKey: "updated",
  format: DEFAULT_DATE_FORMAT,
};

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const WIKI_WRAP = /^\[\[(.+)\]\]$/;
const TZ_SUFFIX = /(?:Z|z|[+-]\d{2}:?\d{2})$/;
/** date + optional time, "T" or space separator, 1-2 digit fields */
const DASHED =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/;
const SLASHED = /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?: (\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/;
const DOTTED = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/;

function build(
  year: string | number,
  month: string | number,
  day: string | number,
  hour?: string | number,
  minute?: string | number,
  second?: string | number,
): ParsedDate | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  if (m < 1 || m > 12) return null;
  const maxDay = m === 2 && isLeapYear(y) ? 29 : DAYS_IN_MONTH[m - 1];
  if (maxDay === undefined || d < 1 || d > maxDay) return null;

  if (hour === undefined) return { year: y, month: m, day: d, hasTime: false };

  const h = Number(hour);
  const mi = Number(minute);
  if (!Number.isInteger(h) || !Number.isInteger(mi) || h > 23 || mi > 59) return null;
  if (second === undefined) {
    return { year: y, month: m, day: d, hour: h, minute: mi, hasTime: true };
  }
  const s = Number(second);
  if (!Number.isInteger(s) || s > 59) return null;
  return { year: y, month: m, day: d, hour: h, minute: mi, second: s, hasTime: true };
}

/** js-yaml turns YAML timestamps into Date objects: date-only values are
 *  constructed in UTC (midnight), datetimes in local time — read
 *  accordingly. UTC-midnight ⇒ date-only; every non-UTC zone then also
 *  formats a true local-midnight datetime correctly via local fields. */
function fromDate(date: Date): ParsedDate | null {
  const dateOnly =
    date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  if (dateOnly) {
    return build(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  return build(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  );
}

/**
 * Parse a raw frontmatter value (string / Date / epoch number) into a
 * structured date, or null when the value is not a recognizable date.
 */
export function parseDateValue(raw: unknown): ParsedDate | null {
  if (raw instanceof Date) return fromDate(raw);
  if (typeof raw === "number") {
    // epoch only at plausible magnitudes: seconds 2001…2286, ms 2001+
    if (!Number.isInteger(raw)) return null;
    if (raw >= 1e12) return fromDate(new Date(raw));
    if (raw >= 1e9 && raw < 1e10) return fromDate(new Date(raw * 1000));
    return null;
  }
  if (typeof raw !== "string") return null;

  let text = raw.trim();
  if (text === "") return null;
  const wrapped = WIKI_WRAP.exec(text);
  if (wrapped?.[1] !== undefined) text = wrapped[1].trim();
  // a trailing timezone suffix never changes the wall-clock display
  const withoutTz = text.replace(TZ_SUFFIX, "").trim();

  const dashed = DASHED.exec(withoutTz);
  if (dashed?.[1] !== undefined) {
    return build(dashed[1], dashed[2] ?? "", dashed[3] ?? "", dashed[4], dashed[5], dashed[6]);
  }
  const slashed = SLASHED.exec(withoutTz);
  if (slashed?.[1] !== undefined) {
    return build(
      slashed[1],
      slashed[2] ?? "",
      slashed[3] ?? "",
      slashed[4],
      slashed[5],
      slashed[6],
    );
  }
  const dotted = DOTTED.exec(withoutTz);
  if (dotted?.[1] !== undefined) {
    return build(dotted[1], dotted[2] ?? "", dotted[3] ?? "");
  }
  return null;
}

const TOKENS = /YYYY|YY|MM|DD|HH|hh|mm|ss/g;
/* plain substring on purpose: no date token contains these sequences,
 * and \b would miss time tokens glued to literals ("YYYY-MM-DDTHH:mm") */
const TIME_TOKEN = /HH|hh|mm|ss/;
const DATE_FALLBACK = "YYYY-MM-DD";

/** Render one whitespace-separated group of the format string. */
function renderGroup(group: string, date: ParsedDate): string {
  return group.replace(TOKENS, (token) => {
    const pad2 = (value: number): string => String(value).padStart(2, "0");
    switch (token) {
      case "YYYY":
        return String(date.year).padStart(4, "0");
      case "YY":
        return pad2(date.year % 100);
      case "MM":
        return pad2(date.month);
      case "DD":
        return pad2(date.day);
      case "HH":
      case "hh":
        return pad2(date.hour ?? 0);
      case "mm":
        return pad2(date.minute ?? 0);
      case "ss":
        return pad2(date.second ?? 0);
      default:
        return token;
    }
  });
}

/** Format a parsed date with moment-style tokens; "" format = default. */
export function formatDateValue(date: ParsedDate, format: string): string {
  const spec = format.trim() === "" ? DEFAULT_DATE_FORMAT : format.trim();
  // a pure date never grows a time part: drop whitespace-separated
  // groups that only carry time tokens (HH / hh / mm / ss)
  const groups = spec.split(" ").filter((group) => date.hasTime || !TIME_TOKEN.test(group));
  const effective = groups.length > 0 ? groups.join(" ") : DATE_FALLBACK;
  return renderGroup(effective, date);
}

/** Parse + format in one step; null when the raw value is not a date. */
export function parseAndFormatDate(raw: unknown, format: string): string | null {
  const parsed = parseDateValue(raw);
  return parsed === null ? null : formatDateValue(parsed, format);
}

/** Read the configured created/updated keys into display strings. */
export function readEntryDates(
  frontmatter: Record<string, unknown> | null | undefined,
  opts: DateReadOptions,
): { created?: string; updated?: string } | undefined {
  const created =
    opts.createdKey === "" ? null : parseAndFormatDate(frontmatter?.[opts.createdKey], opts.format);
  const updated =
    opts.updatedKey === "" ? null : parseAndFormatDate(frontmatter?.[opts.updatedKey], opts.format);
  if (created === null && updated === null) return undefined;
  const dates: { created?: string; updated?: string } = {};
  if (created !== null) dates.created = created;
  if (updated !== null) dates.updated = updated;
  return dates;
}
