/**
 * EventClassifier — maps a debounced batch of raw vault events onto the
 * action list from the DESIGN.md §4.8 matrix. Pure computation against
 * the current registry; the service layer executes the actions.
 */

import type { RawVaultEvent } from "../adapter/ports";
import { BATCH_THRESHOLD } from "../constants";
import type { DomainId, Registry, VaultPath } from "../types";
import { isUnder } from "./path-util";

export type ClassifierAction =
  /** exception ①: single create in a managed domain → write tail order */
  | { type: "write-order"; path: VaultPath; domain: DomainId }
  /** batch arrival (≥ BATCH_THRESHOLD) → blue flag, no auto write */
  | { type: "flag-pending"; paths: VaultPath[]; domain: DomainId }
  /** exception ②: left a managed domain → clear order + strip nav */
  | { type: "clear-order-and-nav"; path: VaultPath; fromDomain: DomainId }
  /** entered a managed domain without an order → blue flag */
  | { type: "flag-entered-pending"; path: VaultPath; domain: DomainId }
  /** entries / index content may be stale */
  | { type: "flag-stale"; domains: DomainId[] }
  /** recompute the affected domains (generic) */
  | { type: "refresh" }
  /** an index page disappeared → the domain dissolved */
  | { type: "domain-dissolved"; domain: DomainId };

/** innermost managed domain containing the path, if any */
export function findDomainOf(registry: Registry, path: VaultPath): DomainId | null {
  let best: DomainId | null = null;
  for (const root of registry.domains.keys()) {
    if (!isUnder(path, root)) continue;
    if (best === null || root.length > best.length) best = root;
  }
  return best;
}

function isChainMember(registry: Registry, domain: DomainId, path: VaultPath): boolean {
  const domain_ = registry.domains.get(domain);
  if (!domain_) return false;
  return domain_.entries.some((entry) => entry.path === path);
}

/** Extra vault context the service layer computes for one batch. */
export interface ClassifyContext {
  /**
   * Managed domains whose root folder no longer exists in the vault at
   * classification time. When a domain's root (or an ancestor of it) is
   * renamed/moved, Obsidian fires a rename for the folder and every
   * child file — without this set each file would classify as "left the
   * domain" and its order would be wiped. A vanished root means the
   * whole domain moved: orders travel with the files, the follow-up
   * scan re-roots the domain, so the batch only refreshes.
   */
  missingRoots?: ReadonlySet<DomainId>;
  /**
   * New paths of file renames that moved TOGETHER WITH their folder
   * (a folder rename in the same batch, or the old parent folder is
   * already gone — split batches included). Folder moves must never
   * clear order in either direction: into a managed domain (the carried
   * order slots the files into the chain) or out of one (the values
   * stay on the notes as legacy orders, nothing silently destroyed).
   */
  movedWithFolder?: ReadonlySet<VaultPath>;
  /**
   * New paths in this batch that are folders (the folder's own rename
   * event) — folder paths must never receive order writes or pending
   * flags.
   */
  folderPaths?: ReadonlySet<VaultPath>;
}

/**
 * Classify a debounced batch. `events` must be pre-merged per path by
 * the EventSource (one event per path per batch).
 */
export function classifyBatch(
  events: readonly RawVaultEvent[],
  registry: Registry,
  ctx: ClassifyContext = {},
): ClassifierAction[] {
  const missingRoots = ctx.missingRoots ?? new Set<DomainId>();
  const movedWithFolder = ctx.movedWithFolder ?? new Set<VaultPath>();
  const folderPaths = ctx.folderPaths ?? new Set<VaultPath>();
  const actions: ClassifierAction[] = [];
  const stale = new Set<DomainId>();

  /* count creates per domain for batch detection */
  const createsPerDomain = new Map<DomainId, VaultPath[]>();
  for (const event of events) {
    if (event.type !== "create") continue;
    const domain = findDomainOf(registry, event.path);
    if (domain === null || registry.domains.get(domain)?.indexPath === event.path) continue;
    const list = createsPerDomain.get(domain) ?? [];
    list.push(event.path);
    createsPerDomain.set(domain, list);
  }

  for (const event of events) {
    switch (event.type) {
      case "create": {
        const domain = findDomainOf(registry, event.path);
        if (domain === null) break;
        if (registry.domains.get(domain)?.indexPath === event.path) {
          // the index page itself appeared (adopt/copy-in): full refresh
          actions.push({ type: "refresh" });
          break;
        }
        const batch = createsPerDomain.get(domain) ?? [];
        if (batch.length >= BATCH_THRESHOLD) {
          actions.push({ type: "flag-pending", paths: batch, domain });
        } else {
          actions.push({ type: "write-order", path: event.path, domain });
        }
        break;
      }
      case "delete": {
        for (const [root, domain] of registry.domains) {
          if (domain.indexPath === event.path) {
            actions.push({ type: "domain-dissolved", domain: root });
          } else if (isChainMember(registry, root, event.path)) {
            stale.add(root);
          }
        }
        actions.push({ type: "refresh" });
        break;
      }
      case "rename": {
        const oldPath = event.oldPath ?? "";
        const newPath = event.path;
        const fromDomain = findDomainOf(registry, oldPath);
        const toDomain = findDomainOf(registry, newPath);
        const isFolder = folderPaths.has(newPath);
        const withFolder = movedWithFolder.has(newPath);

        // the domain root itself moved: never clear orders (they travel
        // with the files); the follow-up scan re-roots the domain
        if (fromDomain !== null && missingRoots.has(fromDomain)) {
          actions.push({ type: "refresh" });
          break;
        }
        if (fromDomain !== null && registry.domains.get(fromDomain)?.indexPath === oldPath) {
          actions.push({ type: "refresh" }); // index page moved: follows the marker
          break;
        }
        if (fromDomain !== null && toDomain === fromDomain) {
          // moved inside the same domain: nav links may change depth
          stale.add(fromDomain);
          actions.push({ type: "refresh" });
          break;
        }
        if (fromDomain !== null) {
          // left a managed domain (to another domain or to nowhere).
          // Files that moved WITH their folder keep their order — it
          // slots them into the target chain or stays as a legacy value;
          // folder paths never receive order writes at all.
          if (!withFolder && !isFolder) {
            actions.push({ type: "clear-order-and-nav", path: newPath, fromDomain });
          }
          stale.add(fromDomain);
          if (toDomain !== null) {
            if (!withFolder && !isFolder) {
              actions.push({ type: "flag-entered-pending", path: newPath, domain: toDomain });
            }
            stale.add(toDomain);
          }
          actions.push({ type: "refresh" });
          break;
        }
        if (toDomain !== null) {
          // entered from an unmanaged location: single files get their
          // legacy order cleared (designed), files that arrived with
          // their folder keep it and join the chain at that value
          if (!withFolder && !isFolder) {
            actions.push({ type: "clear-order-and-nav", path: newPath, fromDomain: "" });
            actions.push({ type: "flag-entered-pending", path: newPath, domain: toDomain });
          } else {
            stale.add(toDomain);
          }
          actions.push({ type: "refresh" });
          break;
        }
        actions.push({ type: "refresh" });
        break;
      }
      case "modify": {
        // frontmatter / body edits: recompute (ties, order changes,
        // mode flips on index pages all surface via refresh)
        actions.push({ type: "refresh" });
        const domain = findDomainOf(registry, event.path);
        if (domain !== null && registry.domains.get(domain)?.indexPath === event.path) {
          actions.push({ type: "refresh" });
        }
        break;
      }
    }
  }

  if (stale.size > 0) actions.push({ type: "flag-stale", domains: [...stale] });
  return actions;
}
