/**
 * Plugin settings persisted to data.json (DESIGN.md §4.9).
 * Field names created/updated/order are fixed and never configurable.
 */
import type { Lang } from "./i18n/index";
import type { DateDisplay } from "./types";

export interface ChapterTrailSettings {
  /** base name (no .md) used when creating new index pages */
  indexFileName: string;
  /** which date index entries show */
  dateDisplay: DateDisplay;
  /** the single gate of every navigation-injection write (default off) */
  injectNavEnabled: boolean;
  /** auto-rebuild the affected domain index after order writes (v1.4) */
  autoRebuildIndex: boolean;
  /** UI language (default English) */
  language: Lang;
  /** hidden debug switch: verbose event-classification logging */
  debug: boolean;
}

export const DEFAULT_SETTINGS: ChapterTrailSettings = {
  indexFileName: "目录",
  dateDisplay: "created",
  injectNavEnabled: false,
  autoRebuildIndex: false,
  language: "en",
  debug: false,
};

export function coerceSettings(raw: unknown): ChapterTrailSettings {
  const source = (
    typeof raw === "object" && raw !== null ? raw : {}
  ) as Partial<ChapterTrailSettings>;
  const dateDisplay =
    source.dateDisplay === "updated" || source.dateDisplay === "both"
      ? source.dateDisplay
      : "created";
  const language: Lang = source.language === "zh" ? "zh" : "en";
  return {
    indexFileName:
      typeof source.indexFileName === "string" && source.indexFileName.trim() !== ""
        ? source.indexFileName.trim()
        : DEFAULT_SETTINGS.indexFileName,
    dateDisplay,
    injectNavEnabled: source.injectNavEnabled === true,
    autoRebuildIndex: source.autoRebuildIndex === true,
    language,
    debug: source.debug === true,
  };
}
