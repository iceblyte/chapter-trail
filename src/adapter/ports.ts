/**
 * Port seams between the core/UI layers and the host (DESIGN.md §2.2).
 * Pure TypeScript — no Obsidian imports here; adapters live beside this
 * file and are the only place allowed to touch the Obsidian API.
 */
import type { VaultPath } from "../types";

/* ---------------- VaultPort ---------------- */

export type RawVaultEventType = "create" | "delete" | "rename" | "modify";

export interface RawVaultEvent {
  type: RawVaultEventType;
  path: VaultPath;
  /** old path for rename events */
  oldPath?: VaultPath;
}

export interface VaultPort {
  /** all .md paths in the vault (POSIX, vault-relative) */
  listMarkdownFiles(): VaultPath[];
  /** all folder paths (excluding the vault root) */
  listFolders(): VaultPath[];
  exists(path: VaultPath): boolean;
  read(path: VaultPath): Promise<string>;
  /** atomic read → transform → write; returns the new content */
  process(path: VaultPath, fn: (data: string) => string): Promise<string>;
  create(path: VaultPath, content: string): Promise<void>;
  /** move a file to the system trash */
  trashFile(path: VaultPath): Promise<void>;
  /** parsed frontmatter from the metadata cache; null = no frontmatter,
   *  undefined = file unknown to the cache */
  getFrontmatter(path: VaultPath): Record<string, unknown> | null | undefined;
  /** subscribe to raw create/delete/rename/modify events; returns unsubscribe */
  onRawEvent(handler: (event: RawVaultEvent) => void): () => void;
}

/* ---------------- ClockPort ---------------- */

export interface ClockPort {
  now(): number;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

/* ---------------- NotifierPort ---------------- */

export interface NotifierPort {
  notice(message: string, ms?: number): void;
}

/* ---------------- ConfirmPort ---------------- */

export interface ConfirmOption {
  id: string;
  /** may contain simple HTML (<b>, <code>) */
  label: string;
  /** may contain simple HTML */
  description?: string;
}

export interface ConfirmSpec {
  title: string;
  /** may contain simple HTML */
  body?: string;
  /** amber warning box */
  warn?: string;
  /** red danger box */
  danger?: string;
  /** grey count line, e.g. "3 files will be written" */
  count?: string;
  /** radio-card choices (three-way dialogs) */
  options?: ConfirmOption[];
  /** toggleable extra choices (stop-managing dialog) */
  checkboxes?: ConfirmOption[];
  /** pre-selected option id */
  selectedOption?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** render the confirm button in danger color */
  confirmDanger?: boolean;
}

export interface ConfirmResult {
  /** false = cancelled / dismissed */
  confirmed: boolean;
  /** chosen radio-card id, when options were given */
  option?: string | undefined;
  /** checked checkbox ids */
  checked?: string[] | undefined;
}

export interface ConfirmPort {
  confirm(spec: ConfirmSpec): Promise<ConfirmResult>;
}
