/**
 * Plugin settings persisted to data.json (DESIGN.md §4.9).
 * The order key is fixed and never configurable; the created/updated
 * date property names and their display format are user-configurable
 * (compatible with the "Update modified date" community plugin).
 */
import type { DateReadOptions } from "./core/date-value";
import { DEFAULT_DATE_FORMAT } from "./core/date-value";
import type { Lang } from "./i18n/index";

export interface ChapterTrailSettings {
  /** base name (no .md) used when creating new index pages */
  indexFileName: string;
  /** render each index entry's created date (default on) */
  indexShowCreated: boolean;
  /** render each index entry's updated date (default off) */
  indexShowUpdated: boolean;
  /** frontmatter key read as the updated date */
  updatedProperty: string;
  /** frontmatter key read as the created date; "" hides created dates */
  createdProperty: string;
  /** moment-style display format for dates (cards + index pages) */
  dateFormat: string;
  /** the single gate of every navigation-injection write (default off) */
  injectNavEnabled: boolean;
  /** auto-rebuild the affected domain index after order writes (v1.4) */
  autoRebuildIndex: boolean;
  /** move a dissolved domain's index page to the trash (default on);
   *  off = the page is demoted to a normal note, markers removed */
  deleteIndexOnDissolve: boolean;
  /** UI language (default English) */
  language: Lang;
  /** hidden debug switch: verbose event-classification logging */
  debug: boolean;
  /** panel card order (domain roots), persisted from drag */
  domainOrder?: string[] | undefined;
  /** dissolved domains whose leftover orders the user deliberately
   *  keeps — their panel banners stay hidden until un-ignored */
  ignoredLegacyFolders?: string[] | undefined;
}

export const DEFAULT_SETTINGS: ChapterTrailSettings = {
  indexFileName: "目录",
  indexShowCreated: true,
  indexShowUpdated: false,
  updatedProperty: "updated",
  createdProperty: "created",
  dateFormat: DEFAULT_DATE_FORMAT,
  injectNavEnabled: false,
  autoRebuildIndex: false,
  deleteIndexOnDissolve: true,
  language: "en",
  debug: false,
};

/** per-language default index file name (prototype baseline) */
export function defaultIndexName(lang: Lang): string {
  return lang === "zh" ? "目录" : "index";
}

export function coerceSettings(raw: unknown): ChapterTrailSettings {
  const source = (
    typeof raw === "object" && raw !== null ? raw : {}
  ) as Partial<ChapterTrailSettings> & { dateDisplay?: unknown };
  const language: Lang = source.language === "zh" ? "zh" : "en";
  // the default index name follows the UI language; a stored name that
  // equals the OTHER language's default is a stale pre-1.x default and
  // migrates (目录 <-> index). A manually customized name never moves.
  let indexFileName =
    typeof source.indexFileName === "string" && source.indexFileName.trim() !== ""
      ? source.indexFileName.trim()
      : defaultIndexName(language);
  if (
    indexFileName === defaultIndexName("zh") &&
    language === "en" &&
    typeof source.indexFileName === "string"
  ) {
    indexFileName = defaultIndexName("en");
  }
  // the pre-round-17 dateDisplay dropdown (created/updated/both) migrates
  // to the two independent toggles when they are not stored yet
  const legacy = typeof source.dateDisplay === "string" ? source.dateDisplay : undefined;
  const indexShowCreated =
    typeof source.indexShowCreated === "boolean" ? source.indexShowCreated : legacy !== "updated"; // created / both / unset → on
  const indexShowUpdated =
    typeof source.indexShowUpdated === "boolean"
      ? source.indexShowUpdated
      : legacy === "updated" || legacy === "both";
  return {
    indexShowCreated,
    indexShowUpdated,
    // the modified-date property is required to stay functional: an empty
    // value falls back to the default; an empty created property is the
    // documented way to hide created dates (mirrors "Update modified date")
    updatedProperty:
      typeof source.updatedProperty === "string" && source.updatedProperty.trim() !== ""
        ? source.updatedProperty.trim()
        : "updated",
    createdProperty:
      typeof source.createdProperty === "string" ? source.createdProperty.trim() : "created",
    dateFormat:
      typeof source.dateFormat === "string" && source.dateFormat.trim() !== ""
        ? source.dateFormat.trim()
        : DEFAULT_DATE_FORMAT,
    injectNavEnabled: source.injectNavEnabled === true,
    autoRebuildIndex: source.autoRebuildIndex === true,
    deleteIndexOnDissolve: source.deleteIndexOnDissolve !== false,
    indexFileName,
    language,
    debug: source.debug === true,
    domainOrder: Array.isArray(source.domainOrder)
      ? source.domainOrder.filter((item): item is string => typeof item === "string")
      : undefined,
    ignoredLegacyFolders: Array.isArray(source.ignoredLegacyFolders)
      ? source.ignoredLegacyFolders.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

/** the date-reading options the resolver should use for these settings */
export function dateReadOptions(settings: ChapterTrailSettings): DateReadOptions {
  return {
    createdKey: settings.createdProperty,
    updatedKey: settings.updatedProperty,
    format: settings.dateFormat,
  };
}

/** which dates the INDEX PAGE renders for these settings */
export function indexDateOptions(settings: ChapterTrailSettings): {
  showCreated: boolean;
  showUpdated: boolean;
} {
  return {
    showCreated: settings.indexShowCreated,
    showUpdated: settings.indexShowUpdated,
  };
}
