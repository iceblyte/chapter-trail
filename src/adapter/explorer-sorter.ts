/**
 * ExplorerSorter — makes Obsidian's native file explorer follow the
 * managed chains: inside every managed folder, child tree items are
 * re-ordered (CSS flex + order) to match the plugin's chain order.
 *
 * Display-only: no DOM of Obsidian's is rewritten, no files move, and
 * unmanaged areas are untouched (unranked items keep their native
 * order behind the ranked ones). The editing surface stays the plugin
 * panel (drag / Move up / Move down) — Obsidian offers no API for
 * drag-sorting its explorer; this class only mirrors the result.
 */
import type { App } from "obsidian";
import type { ManagedDomain, VaultPath } from "../types";
import type { RegistryStore } from "./registry-store";

const AFTER_CHAIN = 100_000;

interface ExplorerFileLike {
  path: string;
  children?: unknown;
}

export class ExplorerSorter {
  private detachStore: (() => void) | null = null;
  private disposers: (() => void)[] = [];
  private timer: number | null = null;

  constructor(
    private readonly app: App,
    private readonly store: RegistryStore,
  ) {}

  start(): void {
    const workspace = (this.app as { workspace: unknown }).workspace as {
      on(name: string, cb: () => void): unknown;
      offref(ref: unknown): void;
    };
    const cache = (this.app as { metadataCache: unknown }).metadataCache as {
      on(name: string, cb: () => void): unknown;
      offref(ref: unknown): void;
    };
    const layoutRef = workspace.on("layout-change", () => this.schedule());
    const resolvedRef = cache.on("resolved", () => this.schedule());
    this.disposers.push(
      () => workspace.offref(layoutRef),
      () => cache.offref(resolvedRef),
    );
    this.detachStore = this.store.subscribe(() => this.schedule());
    this.schedule();
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.detachStore?.();
    this.detachStore = null;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.apply();
    }, 120);
  }

  /** re-apply the current registry to every visible explorer tree */
  apply(): void {
    const registry = this.store.getSnapshot();
    if (registry.domains.size === 0) return;
    const files = this.listFiles();
    for (const domain of registry.domains.values()) {
      this.applyDomain(domain, files);
    }
  }

  private listFiles(): ExplorerFileLike[] {
    const vault = (this.app as { vault?: { getAllLoadedFiles?: () => unknown[] } | undefined })
      .vault;
    const raw = vault?.getAllLoadedFiles?.() ?? [];
    return raw.filter((item): item is ExplorerFileLike => {
      const candidate = item as ExplorerFileLike;
      return typeof candidate?.path === "string";
    });
  }

  private applyDomain(domain: ManagedDomain, files: ExplorerFileLike[]): void {
    // chain rank for every entry (files and managed subfolders)
    const rank = new Map<VaultPath, number>();
    domain.entries.forEach((entry, index) => {
      rank.set(entry.path, index);
    });

    const prefix = domain.root === "" ? "" : `${domain.root}/`;
    for (const file of files) {
      const isFolder = Array.isArray(file.children);
      const inside = file.path === domain.root || (prefix !== "" && file.path.startsWith(prefix));
      if (!isFolder || !inside) continue;
      const container = this.childrenContainerOf(file.path);
      if (container) this.sortContainer(container, rank);
    }
  }

  /** the explorer's child-list element for a folder path, if rendered */
  private childrenContainerOf(folderPath: string): HTMLElement | null {
    const selector = `.tree-item-self[data-path="${cssEscape(folderPath)}"]`;
    for (const self of document.querySelectorAll<HTMLElement>(selector)) {
      const item = self.closest(".tree-item");
      const children = item?.querySelector<HTMLElement>(":scope > .tree-item-children");
      if (children) return children;
    }
    return null;
  }

  private sortContainer(container: HTMLElement, rank: Map<VaultPath, number>): void {
    const items = Array.from(container.querySelectorAll<HTMLElement>(":scope > .tree-item"));
    if (items.length === 0) return;
    let touched = false;
    for (const item of items) {
      const self = item.querySelector<HTMLElement>(":scope > .tree-item-self");
      const path = self?.getAttribute("data-path");
      if (path === null || path === undefined) continue;
      const position = rank.get(path);
      item.style.order = position === undefined ? String(AFTER_CHAIN) : String(position + 1);
      touched = true;
    }
    if (touched) {
      // `order` only applies in a flex container — the same trick the
      // community sorting plugins use on this exact node
      container.style.display = "flex";
      container.style.flexDirection = "column";
    }
  }
}

function cssEscape(value: string): string {
  return globalThis.CSS && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/["\\]/g, "\\$&");
}
