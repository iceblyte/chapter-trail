/**
 * Core domain types (DESIGN.md §2.4).
 *
 * Paths are vault-relative with POSIX separators ("/"), never starting
 * with "/". All types here are plain data — the core layer never touches
 * the Obsidian API.
 */

export type VaultPath = string;

/** Domain root folder path (vault-relative, never the vault root itself). */
export type DomainId = VaultPath;

export type DomainMode = "independent" | "series";

export type DateDisplay = "created" | "updated" | "both";

export type EntryKind = "file" | "managed-folder";

export interface EntryDates {
  created?: string;
  updated?: string;
}

/** One chain member. For `managed-folder` entries the path is the folder
 *  path and `order` comes from that subfolder's own index frontmatter. */
export interface OrderEntry {
  path: VaultPath;
  kind: EntryKind;
  /** display title (basename without .md, or folder name) */
  title: string;
  /** series-mode path prefix relative to the domain root, e.g. "进阶篇/" */
  prefix?: string;
  order?: number;
  dates?: EntryDates;
}

/** Plain-text trailing entry for unmanaged subfolders (independent mode).
 *  `files` lists the folder's markdown files for the panel's expandable
 *  view; empty folders are included with an empty list (round 18). */
export interface UnmanagedFolder {
  path: VaultPath;
  title: string;
  files: VaultPath[];
}

export type ConflictKind =
  | "nested-index" // series domain contains another marked index page
  | "duplicate-index"; // same folder holds two marked index pages

export interface ConflictInfo {
  kind: ConflictKind;
  /** offending index page / folder, for the Resolve… dialog */
  path: VaultPath;
  detail?: string;
}

/** Red / yellow / blue status flags (PRD §2.7, merged red semantics). */
export interface DomainStatus {
  /** red: index links whose target no longer exists */
  broken: VaultPath[];
  /** red: structural conflicts */
  conflicts: ConflictInfo[];
  /** blue: entered the domain but carry no order yet */
  pending: VaultPath[];
  /** yellow: entries / nav may be stale — rebuild suggested */
  stale: boolean;
  /** yellow: equal order values (filename natural order kicks in) */
  ties: VaultPath[];
  /** yellow: some adjacent gap < GAP_THRESHOLD */
  tightGap: boolean;
  /** yellow: first-declare kept pre-existing order values */
  legacyHint: boolean;
}

/** A managed domain = folder with a marked index page. */
export interface ManagedDomain {
  root: DomainId;
  mode: DomainMode;
  indexPath: VaultPath;
  /** the ordered chain (already sorted, ties resolved by filename) */
  entries: OrderEntry[];
  /** independent mode only: unmanaged non-empty subfolders, name-sorted,
   *  rendered as plain text after all managed entries */
  unmanagedFolders: UnmanagedFolder[];
  /** excluded-folders values (relative to domain root) */
  excludedFolders: string[];
  status: DomainStatus;
}

/** The full picture of a vault, rebuilt from a scan or incrementally. */
export interface Registry {
  domains: Map<DomainId, ManagedDomain>;
  /** marked index pages with structural anomalies (e.g. vault root) */
  orphans: VaultPath[];
  /** dissolved domains → files still carrying order fields */
  legacyOrders: Map<DomainId, VaultPath[]>;
}

/** File metadata needed by the resolver (sourced from metadataCache). */
export interface FileMeta {
  path: VaultPath;
  /** parsed frontmatter, null when absent */
  frontmatter: Record<string, unknown> | null;
}

/** Minimal folder listing entry. */
export interface FolderMeta {
  path: VaultPath;
}

export function emptyStatus(): DomainStatus {
  return {
    broken: [],
    conflicts: [],
    pending: [],
    stale: false,
    ties: [],
    tightGap: false,
    legacyHint: false,
  };
}

export function emptyRegistry(): Registry {
  return {
    domains: new Map(),
    orphans: [],
    legacyOrders: new Map(),
  };
}
