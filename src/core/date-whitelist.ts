/**
 * created / updated date parsing against the PRD §2.5 whitelist.
 *
 * Accepted: Obsidian date property (`YYYY-MM-DD`), Obsidian datetime
 * property (`YYYY-MM-DDTHH:mm` / `YYYY-MM-DDTHH:mm:ss`), the `[[...]]`
 * wrapped form of both, and plain ISO text of the same shapes.
 * Everything else fails → the entry shows no date.
 *
 * Returns the `YYYY-MM-DD` date part only; no timezone math ever happens
 * (these dates are pure display semantics).
 */

const ACCEPTED = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const WIKI_WRAP = /^\[\[(.+)\]\]$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Parse a raw frontmatter value into `YYYY-MM-DD`, or null if not whitelisted. */
export function parseWhitelistedDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  if (text === "") return null;
  const wrapped = WIKI_WRAP.exec(text);
  if (wrapped?.[1] !== undefined) text = wrapped[1].trim();

  const match = ACCEPTED.exec(text);
  if (!match?.[1] || !match[2] || !match[3]) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) return null;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (maxDay === undefined || day < 1 || day > maxDay) return null;

  if (match[4] !== undefined) {
    if (Number(match[4]) > 23 || Number(match[5]) > 59) return null;
    if (match[6] !== undefined && Number(match[6]) > 59) return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}
