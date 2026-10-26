/**
 * Panel actions — the seam between React components and the plugin.
 * Implemented by ChapterTrailPlugin; components stay pure/presentational.
 */
import type { DomainId, DomainMode, VaultPath } from "../types";

export interface StartManagingPreview {
  missingOrderCount: number;
  hasNameClash: boolean;
  existingOrders: number;
}

export interface PanelActions {
  /** re-scan the whole vault (⟳ in the header) */
  rescan(): Promise<void>;
  /** open the plugin settings tab */
  openSettings(): void;
  /** review + clear a dissolved domain's leftover orders (confirmed) */
  reviewLegacyOrders(domain: DomainId): void | Promise<void>;

  rebuildIndex(root: DomainId): Promise<void>;
  reindexOrder(root: DomainId): Promise<void>;
  rebuildInjection(root: DomainId): Promise<void>;
  openIndexPage(indexPath: VaultPath): void;
  /** open a note in the editor (panel row click) */
  openFile(path: VaultPath): void;
  copyDomainPath(root: DomainId): void;
  stopManaging(root: DomainId): Promise<void>;
  resolveConflict(root: DomainId, conflictPath: VaultPath): Promise<void>;

  /** move an entry to `targetIndex` within the chain (drag / menu) */
  moveEntry(root: DomainId, path: VaultPath, targetIndex: number): Promise<void>;
  /** physically move a note into another folder of the domain */
  moveFileToFolder(root: DomainId, filePath: VaultPath, targetFolder: VaultPath): Promise<void>;
  /** move a whole series subfolder as one block (drag) */
  moveFolder(
    root: DomainId,
    folderPath: VaultPath,
    target: { path: VaultPath; isFolder: boolean; edge: "top" | "bottom" },
  ): Promise<void>;

  /** two-step start-managing flow (prototype 04), mode picked in step 2 */
  startManagingFlow(folder: DomainId, mode: DomainMode): Promise<void>;
  /** start managing with the mode-picker dialog (unmanaged folder row) */
  startManagingWithModePicker(folder: DomainId): Promise<void>;
  /** reorder the domain cards in the panel */
  reorderDomains(order: readonly DomainId[]): Promise<void>;
  /** pre-check for the flow's confirmation copy (write counts etc.) */
  previewStartManaging(folder: DomainId): StartManagingPreview;
  /** candidate folders for the flow, with metadata for the picker */
  listFolderCandidates(): FolderCandidate[];
}

export interface FolderCandidate {
  path: DomainId;
  noteCount: number;
  subfolderCount: number;
  orderlessCount: number;
  managed: boolean;
}
