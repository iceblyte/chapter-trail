/**
 * Panel actions — the seam between React components and the plugin.
 * Implemented by ChapterTrailPlugin; components stay pure/presentational.
 */
import type { DomainId, DomainMode, VaultPath } from "../types";

export interface PanelActions {
  /** re-scan the whole vault (⟳ in the header) */
  rescan(): Promise<void>;
  /** open the plugin settings tab */
  openSettings(): void;
  /** open the vault-wide legacy-order review notice */
  reviewLegacyOrders(domain: DomainId): void;

  rebuildIndex(root: DomainId): Promise<void>;
  reindexOrder(root: DomainId): Promise<void>;
  rebuildInjection(root: DomainId): Promise<void>;
  openIndexPage(indexPath: VaultPath): void;
  copyDomainPath(root: DomainId): void;
  stopManaging(root: DomainId): Promise<void>;
  resolveConflict(root: DomainId, conflictPath: VaultPath): Promise<void>;

  /** move an entry to `targetIndex` within the chain (drag / menu) */
  moveEntry(root: DomainId, path: VaultPath, targetIndex: number): Promise<void>;

  /** two-step start-managing flow (prototype 04), mode picked in step 2 */
  startManagingFlow(folder: DomainId, mode: DomainMode): Promise<void>;
  /** candidate folders for the flow, with metadata for the picker */
  listFolderCandidates(): FolderCandidate[];
}

export interface FolderCandidate {
  path: DomainId;
  noteCount: number;
  managed: boolean;
}
