/**
 * i18n dictionaries (PRD §2.7, DESIGN §4.9).
 *
 * Keys are the English UI copy exactly as it appears in the confirmed
 * prototype; `zh.ts` is therefore the canonical key list and `en.ts`
 * derives an identity map from it (a unit test pins key parity).
 * Interpolation placeholders: {n} {total} {domain} {indexFile} {mode}.
 */
import { zh } from "./zh";

export type Lang = "en" | "zh";

export type Dict = Readonly<Record<string, string>>;

/** en is identity — the key *is* the English copy. */
export const en: Dict = Object.fromEntries(Object.keys(zh).map((k) => [k, k]));

export { zh };

/** Look up `key` in `dict`, falling back to the key itself. */
export function lookup(dict: Dict, key: string): string {
  return dict[key] ?? key;
}

/** Interpolate {placeholder} params into a translated string. */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
