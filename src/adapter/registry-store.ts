/**
 * RegistryStore — the single mutable holder of the vault Registry
 * (DESIGN.md §2.4). Snapshots are replaced wholesale; React consumes
 * them via useSyncExternalStore with a stable reference per version.
 */
import type { DomainId, DomainStatus, Registry } from "../types";
import { emptyRegistry } from "../types";

export class RegistryStore {
  private current: Registry = emptyRegistry();
  private listeners = new Set<() => void>();
  private currentVersion = 0;

  getSnapshot(): Registry {
    return this.current;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replace(next: Registry): void {
    this.current = next;
    this.currentVersion += 1;
    this.emit();
  }

  /** monotonically increasing — React keys derive from it to force
   *  remounts when the registry changes (virtualizer row reuse) */
  getVersion(): number {
    return this.currentVersion;
  }

  /** apply a status transform to the given domains (immutably) */
  patchStatus(roots: readonly DomainId[], transform: (status: DomainStatus) => DomainStatus): void {
    if (roots.length === 0) return;
    let changed = false;
    const domains = new Map(this.current.domains);
    for (const root of roots) {
      const domain = domains.get(root);
      if (!domain) continue;
      domains.set(root, { ...domain, status: transform({ ...domain.status }) });
      changed = true;
    }
    if (!changed) return;
    this.current = { ...this.current, domains };
    this.emit();
  }

  /** mark domains stale (yellow) */
  markStale(roots: readonly DomainId[]): void {
    this.patchStatus(roots, (status) => ({ ...status, stale: true }));
  }

  /** add paths to the pending (blue) list of a domain */
  addPending(root: DomainId, paths: readonly string[]): void {
    if (paths.length === 0) return;
    this.patchStatus([root], (status) => {
      const merged = new Set([...status.pending, ...paths]);
      return { ...status, pending: [...merged] };
    });
  }

  clear(): void {
    this.current = emptyRegistry();
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
