/**
 * Project-wide constants (DESIGN.md §2.4).
 *
 * T0 items are settled on the confirmed prototype baseline:
 * raw relative markdown links, `[!chapter-trail]-` callouts and the
 * default index file name 目录 — all kept here as single switch points
 * in case the Quartz spike ever revisits them (PRD §6 R1 / DESIGN §5.6).
 */

/** order initial / reindex step: 10000, 20000, 30000… */
export const STEP = 10_000;

/** adjacent gap below this → yellow "gaps too tight" (PRD §2.3) */
export const GAP_THRESHOLD = 10;

/** ≥5 creates inside one debounce window → batch blue flag, no auto write */
export const BATCH_THRESHOLD = 5;

/** bulk-write chunk size (files per chunk, DESIGN §5.5) */
export const WRITE_CHUNK = 25;

/** event debounce window in ms */
export const DEBOUNCE_MS = 750;

/** echo-suppression ledger TTL in ms */
export const ECHO_TTL_MS = 5_000;

/** The only frontmatter keys the plugin is ever allowed to write. */
export const PLUGIN_KEYS = {
  isIndex: "is-index",
  mode: "mode",
  order: "order",
  excluded: "excluded",
  excludedFolders: "excluded-folders",
} as const;

export type PluginKey = (typeof PLUGIN_KEYS)[keyof typeof PLUGIN_KEYS];

export const PLUGIN_KEY_SET: ReadonlySet<string> = new Set(Object.values(PLUGIN_KEYS));

/** Index-page marker block (PRD §2.1, plugin-owned). */
export const INDEX_BLOCK_BEGIN = "<!-- chapter-trail:begin -->";
export const INDEX_BLOCK_END = "<!-- chapter-trail:end -->";

/** Navigation injection wrapper markers (PRD §2.6). */
export const NAV_BLOCK_BEGIN = "<!-- chapter-trail:nav-begin -->";
export const NAV_BLOCK_END = "<!-- chapter-trail:nav-end -->";

/** Callout type written by the injector; `-` makes it collapsible. */
export const CALLOUT_TYPE = "chapter-trail";

/** Panel row height in px — fixed for virtualization (DESIGN §4.10). */
export const ROW_HEIGHT = 32;
