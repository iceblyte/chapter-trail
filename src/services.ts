/**
 * PluginServices — the application orchestration layer tying the core
 * modules to the ports (DESIGN.md §2.1 app layer). Owns the watcher
 * pipeline, every user-triggered flow (start/stop managing, rebuilds,
 * injection, conflicts, remove-all, jumps) and all confirmation dialogs
 * (M1–M6 per prototype 05).
 */

import type { ChunkedWriter, WriteTask } from "./adapter/chunked-writer";
import { EventSource } from "./adapter/event-source";
import type {
  ClockPort,
  ConfirmPort,
  NotifierPort,
  RawVaultEvent,
  VaultPort,
} from "./adapter/ports";
import type { RegistryStore } from "./adapter/registry-store";
import { PLUGIN_KEYS } from "./constants";
import {
  hasNavBlocks,
  removeIndexBlock,
  stripNavBlocks,
  writeIndexBlock,
} from "./core/block-codec";
import { buildRegistry, type VaultSnapshot } from "./core/domain-resolver";
import type { EchoLedger } from "./core/echo-ledger";
import { classifyBatch, findDomainOf } from "./core/event-classifier";
import { patchFrontmatter } from "./core/frontmatter-patch";
import { renderIndexInner } from "./core/index-renderer";
import {
  buildInjectionPlan,
  buildStripPlan,
  type InjectionGate,
  openInjectionGate,
} from "./core/nav-writer";
import { isUnder, joinPath, noteTitle, parentOf, relativeInside } from "./core/path-util";
import {
  buildSeriesTree,
  detachSeriesNode,
  findSeriesNode,
  flattenSeriesTree,
} from "./core/series-tree";
import { normalizedOrder, orderValue, planInsert, tailOrder } from "./core/sort-core";
import type { I18nService } from "./i18n/runtime";
import { type ChapterTrailSettings, dateReadOptions } from "./settings";
import type { DomainId, DomainMode, ManagedDomain, Registry, VaultPath } from "./types";

export interface ServiceDeps {
  vault: VaultPort;
  clock: ClockPort;
  notifier: NotifierPort;
  confirm: ConfirmPort;
  i18n: I18nService;
  writer: ChunkedWriter;
  ledger: EchoLedger;
  store: RegistryStore;
  /** Obsidian parseYaml for the frontmatter safety valve */
  parseYaml?: (text: string) => unknown;
  /** open a note in the editor (jump commands) */
  openFile: (path: VaultPath) => void;
}

export interface StartManagingPreview {
  missingOrderCount: number;
  hasNameClash: boolean;
  existingOrders: number;
}

export class PluginServices {
  private eventSource: EventSource | null = null;
  private rescanning = false;

  constructor(
    private readonly deps: ServiceDeps,
    private readonly settings: ChapterTrailSettings,
  ) {}

  /* ---------------- scanning & watching ---------------- */

  async scan(): Promise<void> {
    if (this.rescanning) return;
    this.rescanning = true;
    try {
      const registry = await this.readRegistry();
      this.deps.store.replace(registry);
    } finally {
      this.rescanning = false;
    }
  }

  /** full recompute, carrying event-driven flags over */
  private async readRegistry(): Promise<Registry> {
    const previous = this.deps.store.getSnapshot();
    const files = this.deps.vault.listMarkdownFiles().map((path) => ({
      path,
      frontmatter: this.deps.vault.getFrontmatter(path) ?? null,
    }));
    const snapshot: VaultSnapshot = {
      files,
      readFileBody: (path) => this.deps.vault.read(path),
    };
    const next = await buildRegistry(snapshot, { dates: dateReadOptions(this.settings) });
    // carry sticky flags: stale survives until a manual rebuild;
    // pending survives as long as the files still lack an order
    for (const domain of next.domains.values()) {
      const old = previous.domains.get(domain.root);
      if (!old) continue;
      if (old.status.stale) domain.status.stale = true;
      if (old.status.legacyHint) domain.status.legacyHint = true;
      if (old.status.pending.length > 0) {
        const stillPending = old.status.pending.filter((path) =>
          domain.entries.some((entry) => entry.path === path && entry.order === undefined),
        );
        if (stillPending.length > 0) {
          domain.status.pending = [...new Set([...domain.status.pending, ...stillPending])];
        }
      }
    }
    return next;
  }

  startWatching(): void {
    if (this.eventSource) return;
    this.eventSource = new EventSource(this.deps.vault, this.deps.clock, this.deps.ledger);
    this.eventSource.start((events) => this.handleBatch(events));
  }

  stopWatching(): void {
    this.eventSource?.stop();
    this.eventSource = null;
  }

  /**
   * Re-scan once more after the host has settled (metadata cache
   * reindexing is async in Obsidian). Cheap insurance: if the first
   * scan read a partially-stale cache, this one converges the panel.
   */
  private scheduleSettledScan(): void {
    this.deps.clock.setTimeout(() => {
      void this.scan().catch((error) => {
        console.error("[chapter-trail] settle scan failed", error);
      });
    }, 600);
  }

  /** watcher entry point (EventSource batches land here) */
  handleExternalBatch(events: readonly RawVaultEvent[]): Promise<void> {
    return this.handleBatch(events);
  }

  /** innermost managed domain containing the path, if any */
  domainContaining(path: VaultPath): ManagedDomain | null {
    const registry = this.deps.store.getSnapshot();
    let best: ManagedDomain | null = null;
    for (const domain of registry.domains.values()) {
      if (!isUnder(path, domain.root)) continue;
      if (!best || domain.root.length > best.root.length) best = domain;
    }
    return best;
  }

  private async handleBatch(events: readonly RawVaultEvent[]): Promise<void> {
    const registry = this.deps.store.getSnapshot();
    const actions = classifyBatch(events, registry);
    const tasks: WriteTask[] = [];

    for (const action of actions) {
      switch (action.type) {
        case "write-order": {
          const domain = registry.domains.get(action.domain);
          if (!domain) break;
          const max = Math.max(
            0,
            ...domain.entries
              .map((entry) => entry.order)
              .filter((order): order is number => order !== undefined),
          );
          const next = tailOrder(max);
          if (next === null) {
            // overflow: normalize the domain instead (DESIGN 4.3)
            tasks.push(...this.normalizeTasks(domain));
            this.deps.notifier.notice(
              this.deps.i18n.t("Order normalized — {n} notes", {
                n: domain.entries.length,
              }) +
                " · " +
                action.domain,
            );
          } else {
            tasks.push(this.orderWrite(action.path, next));
          }
          break;
        }
        case "clear-order-and-nav": {
          tasks.push({
            path: action.path,
            apply: (raw) => {
              const stripped = stripNavBlocks(raw).text;
              const patched = patchFrontmatter(
                stripped,
                [{ op: "remove", key: PLUGIN_KEYS.order }],
                { parseYaml: this.deps.parseYaml },
              );
              return patched.ok ? patched.text : stripped;
            },
          });
          break;
        }
        case "flag-pending": {
          this.deps.store.addPending(action.domain, action.paths);
          break;
        }
        case "flag-entered-pending": {
          this.deps.store.addPending(action.domain, [action.path]);
          break;
        }
        case "flag-stale": {
          this.deps.store.markStale(action.domains);
          break;
        }
        case "domain-dissolved": {
          this.deps.notifier.notice(`${this.deps.i18n.t("✓ Domain dissolved")} — ${action.domain}`);
          break;
        }
        case "refresh":
          break;
      }
    }

    if (tasks.length > 0) {
      await this.deps.writer.run(tasks);
      if (this.settings.autoRebuildIndex) {
        const roots = new Set(
          tasks
            .map((task) => findDomainOf(registry, task.path))
            .filter((root): root is DomainId => root !== null),
        );
        for (const root of roots) await this.rebuildIndex(root, { silent: true });
      }
    }
    await this.scan();
  }

  /** failed writes must never disappear silently (locked files etc.) */
  private reportFailures(
    stage: string,
    failed: readonly { path: VaultPath; error: string }[],
  ): void {
    if (failed.length === 0) return;
    console.error(`[chapter-trail] ${stage}: ${failed.length} writes failed`, failed);
    this.deps.notifier.notice(
      this.deps.i18n.t("Write failed for {n} files — see developer console", {
        n: failed.length,
      }),
    );
  }

  private orderWrite(path: VaultPath, value: number): WriteTask {
    return {
      path,
      apply: (raw) => {
        const patched = patchFrontmatter(raw, [{ op: "upsert", key: PLUGIN_KEYS.order, value }], {
          parseYaml: this.deps.parseYaml,
        });
        return patched.ok ? patched.text : raw;
      },
    };
  }

  /* ---------------- domain lifecycle ---------------- */

  private indexPathFor(folder: DomainId): VaultPath {
    return joinPath(folder, `${this.settings.indexFileName}.md`);
  }

  previewStartManaging(folder: DomainId): StartManagingPreview {
    const indexPath = this.indexPathFor(folder);
    const files = this.deps.vault
      .listMarkdownFiles()
      .filter((path) => isUnder(path, folder))
      .filter((path) => path !== indexPath);
    let existingOrders = 0;
    let missing = 0;
    for (const path of files) {
      const fm = this.deps.vault.getFrontmatter(path);
      if (orderValue(fm?.[PLUGIN_KEYS.order]) === undefined) missing += 1;
      else existingOrders += 1;
    }
    return {
      missingOrderCount: missing,
      hasNameClash: this.deps.vault.exists(indexPath),
      existingOrders,
    };
  }

  /** Create the index page (+ first-run order assignment). The caller
   *  has already walked the two-step dialog (prototype 04). */
  async startManaging(folder: DomainId, mode: DomainMode): Promise<void> {
    if (folder === "") throw new Error("vault root cannot be managed");
    // a series domain absorbs its whole subtree — no nested management
    // inside one (only independent domains allow managed subfolders)
    const enclosingSeries = this.findEnclosingSeries(folder);
    if (enclosingSeries !== null) {
      this.deps.notifier.notice(
        this.deps.i18n.t(
          "“{folder}” is inside the series domain “{domain}” — its whole subtree is already managed; only independent domains allow managing subfolders",
          { folder, domain: enclosingSeries },
        ),
      );
      return;
    }
    const indexPath = this.indexPathFor(folder);
    const t = this.deps.i18n.t.bind(this.deps.i18n);

    let adopted = false;
    if (this.deps.vault.exists(indexPath)) {
      const choice = await this.deps.confirm.confirm({
        title: t("{indexFile}.md already exists", { indexFile: this.settings.indexFileName }),
        body: t(
          "The target folder already has a file named <b>{indexFile}.md</b> without a chapter-trail marker. What should happen?",
          { indexFile: this.settings.indexFileName },
        ),
        options: [
          {
            id: "adopt",
            label: t("Adopt it"),
            description: t(
              "Keep all existing frontmatter keys; the existing list and body stay <b>outside</b> the plugin’s marked block, byte-identical. The plugin only appends its keys and the marked block.",
            ),
          },
          {
            id: "rename",
            label: t("Rename and keep"),
            description: t("Keep the existing file under a new name, create a fresh index page."),
          },
          { id: "cancel", label: t("Do nothing.") },
        ],
        selectedOption: "adopt",
        confirmLabel: t("Confirm"),
      });
      if (!choice.confirmed || choice.option === "cancel") return;
      if (choice.option === "rename") {
        const base = noteTitle(indexPath);
        await this.deps.vault.rename(indexPath, joinPath(folder, `${base}-旧.md`));
      } else {
        adopted = true;
      }
    }

    /* index page content */
    const freshPage = `---\n${PLUGIN_KEYS.isIndex}: true\n${PLUGIN_KEYS.mode}: ${mode}\n---\n<!-- chapter-trail:begin -->\n\n<!-- chapter-trail:end -->\n`;

    if (adopted) {
      const raw = await this.deps.vault.read(indexPath);
      const patchedFm = patchFrontmatter(
        raw,
        [
          { op: "upsert", key: PLUGIN_KEYS.isIndex, value: true },
          { op: "upsert", key: PLUGIN_KEYS.mode, value: mode },
        ],
        { parseYaml: this.deps.parseYaml },
      );
      const base = patchedFm.ok ? patchedFm.text : raw;
      const next = writeIndexBlock(base, "");
      this.deps.ledger.register(indexPath, next);
      await this.deps.vault.process(indexPath, () => next);
    } else {
      this.deps.ledger.register(indexPath, freshPage);
      await this.deps.vault.create(indexPath, freshPage);
    }

    /* first-run order assignment: missing orders get filename order */
    const preview = this.previewStartManaging(folder);
    if (preview.missingOrderCount > 0) {
      await this.assignFirstRunOrders(folder);
    }

    await this.scan();
    const domain = this.deps.store.getSnapshot().domains.get(folder);
    if (domain) {
      if (preview.existingOrders > 0) {
        this.deps.store.patchStatus([folder], (status) => ({
          ...status,
          legacyHint: true,
        }));
      }
      await this.rebuildIndex(folder, { silent: true });
    }

    this.deps.notifier.notice(t("✓ Domain created — {domain}", { domain: folder }));
  }

  /** 首次声明: assign 10000-step orders to orderless notes, filename order. */
  async assignFirstRunOrders(folder: DomainId): Promise<number> {
    const indexPath = this.indexPathFor(folder);
    const missing = this.deps.vault
      .listMarkdownFiles()
      .filter((path) => isUnder(path, folder) && path !== indexPath)
      .filter((path) => {
        const fm = this.deps.vault.getFrontmatter(path);
        return (
          fm?.[PLUGIN_KEYS.isIndex] !== true && orderValue(fm?.[PLUGIN_KEYS.order]) === undefined
        );
      })
      .sort((a, b) => a.localeCompare(b, "zh", { numeric: true }));
    const tasks = missing.map((path, index) => this.orderWrite(path, normalizedOrder(index)));
    if (tasks.length > 0) await this.deps.writer.run(tasks);
    return tasks.length;
  }

  async stopManaging(
    root: DomainId,
    opts: { clearOrder: boolean; stripNav: boolean },
  ): Promise<void> {
    const domain = this.deps.store.getSnapshot().domains.get(root);
    if (!domain) return;
    const tasks: WriteTask[] = [];
    if (opts.clearOrder || opts.stripNav) {
      for (const entry of domain.entries) {
        if (entry.kind !== "file") continue;
        tasks.push({
          path: entry.path,
          apply: (raw) => {
            let text = opts.stripNav ? stripNavBlocks(raw).text : raw;
            if (opts.clearOrder) {
              const patched = patchFrontmatter(text, [{ op: "remove", key: PLUGIN_KEYS.order }], {
                parseYaml: this.deps.parseYaml,
              });
              if (patched.ok) text = patched.text;
            }
            return text;
          },
        });
      }
    }
    if (tasks.length > 0) await this.deps.writer.run(tasks);
    this.deps.ledger.registerAbsent(domain.indexPath);
    await this.deps.vault.trashFile(domain.indexPath);
    await this.scan();
  }

  /* ---------------- index & orders ---------------- */

  async rebuildIndex(root: DomainId, options: { silent?: boolean } = {}): Promise<number> {
    const t = this.deps.i18n.t.bind(this.deps.i18n);
    const registry = this.deps.store.getSnapshot();
    const domain = registry.domains.get(root);
    if (!domain) return 0;

    if (!options.silent) {
      const choice = await this.deps.confirm.confirm({
        title: t("Rebuild index"),
        body:
          t("Rebuild the index page for <b>{domain}</b>?", { domain: root }) +
          "<br>" +
          t(
            "Rewrites the marked block in <code>{indexFile}.md</code>. Content outside the block — including your own preamble — is untouched.",
            { indexFile: this.settings.indexFileName },
          ),
        count: t("1 file will be written"),
        confirmLabel: t("Rebuild"),
      });
      if (!choice.confirmed) return 0;
    }

    const inner = renderIndexInner(domain, registry, {
      dateDisplay: this.settings.dateDisplay,
    });
    const result = await this.deps.writer.run([
      {
        path: domain.indexPath,
        apply: (raw) => writeIndexBlock(raw, inner),
      },
    ]);
    // rescan so dead links recorded against the old block clear (A4)
    await this.scan();
    this.deps.store.patchStatus([root], (status) => ({ ...status, stale: false }));
    if (!options.silent) {
      this.deps.notifier.notice(t("✓ Index rebuilt"));
    }
    return result.written.length;
  }

  async rebuildAllIndexes(): Promise<number> {
    const t = this.deps.i18n.t.bind(this.deps.i18n);
    const roots = [...this.deps.store.getSnapshot().domains.keys()];
    if (roots.length === 0) return 0;
    const choice = await this.deps.confirm.confirm({
      title: t("Rebuild all indexes — {n} domains", { n: roots.length }),
      count: t("{n} files will be written", { n: roots.length }),
      confirmLabel: t("Rebuild"),
    });
    if (!choice.confirmed) return 0;
    let written = 0;
    for (const root of roots) {
      written += await this.rebuildIndex(root, { silent: true });
    }
    return written;
  }

  async reindexOrder(root: DomainId): Promise<number> {
    const registry = this.deps.store.getSnapshot();
    const domain = registry.domains.get(root);
    if (!domain) return 0;
    const tasks = this.normalizeTasks(domain);
    const result = await this.deps.writer.run(tasks);
    this.reportFailures("reindexOrder", result.failed);
    this.deps.notifier.notice(
      this.deps.i18n.t("Order normalized — {n} notes", { n: domain.entries.length }),
    );
    await this.scan();
    if (this.settings.autoRebuildIndex) {
      await this.rebuildIndex(root, { silent: true });
    }
    return result.written.length;
  }

  private normalizeTasks(domain: ManagedDomain): WriteTask[] {
    const tasks: WriteTask[] = [];
    const registry = this.deps.store.getSnapshot();
    domain.entries.forEach((entry, index) => {
      const target = normalizedOrder(index);
      if (entry.order === target) return;
      tasks.push(this.orderWrite(this.writableTarget(registry, entry.path), target));
    });
    return tasks;
  }

  /**
   * Managed-folder entries carry the folder path, but orders are written
   * to the subdomain's index page — translate before any write.
   */
  private writableTarget(registry: Registry, entryPath: VaultPath): VaultPath {
    const domain = registry.domains.get(entryPath);
    return domain?.indexPath ?? entryPath;
  }

  /**
   * Move a whole series subfolder (all its chain members) to sit at
   * full-chain position `targetChainIndex`, then normalize the domain
   * to 10000 steps. Block-moving keeps the panel tree and the native
   * explorer in sync — both place a folder at its first file.
   */
  /**
   * Move a whole series subfolder. The new chain is derived FROM THE
   * TREE: the folder node is detached and re-inserted relative to the
   * drop target (a folder target spans its whole subtree), then the
   * tree is flattened back — so the panel tree, the native explorer
   * and the chain stay identical after every move.
   */
  async moveFolder(
    root: DomainId,
    folderPath: VaultPath,
    target: { path: VaultPath; isFolder: boolean; edge: "top" | "bottom" },
  ): Promise<void> {
    const registry = this.deps.store.getSnapshot();
    const domain = registry.domains.get(root);
    if (!domain) return;

    const ordered = domain.entries;
    const tree = buildSeriesTree(ordered, root);

    // resolve the drop target span BEFORE detaching — the target may be
    // a row of the folder being moved itself
    let targetPos: number | null = null;
    if (target.isFolder) {
      const node = findSeriesNode(tree, root, target.path);
      const subtree = node ? flattenSeriesTree(node) : [];
      const firsts = subtree.map((entry) =>
        ordered.findIndex((candidate) => candidate.path === entry.path),
      );
      const valid = firsts.filter((index) => index !== -1);
      if (valid.length > 0) {
        const first = Math.min(...valid);
        const last = Math.max(...valid);
        targetPos = target.edge === "bottom" ? last + 1 : first;
      }
    } else {
      const at = ordered.findIndex((entry) => entry.path === target.path);
      if (at !== -1) targetPos = target.edge === "bottom" ? at + 1 : at;
    }
    if (targetPos === null) {
      // target unresolvable (e.g. dropped onto the folder's own row)
      this.deps.notifier.notice(
        this.deps.i18n.t("Nothing to move — the drop position is unchanged"),
      );
      return;
    }

    const detached = detachSeriesNode(tree, root, folderPath);
    if (!detached) return;
    const block = flattenSeriesTree(detached);
    if (block.length === 0) return;

    const rest = flattenSeriesTree(tree);
    // targetPos is a FULL-CHAIN index; the block's own members before it
    // must be subtracted to get the insertion point within rest
    const chainIndexOf = new Map(ordered.map((entry, index) => [entry.path, index]));
    const blockBefore = block.filter(
      (entry) => (chainIndexOf.get(entry.path) ?? 0) < targetPos,
    ).length;
    const pos = Math.max(0, Math.min(targetPos - blockBefore, rest.length));
    const simulated = [...rest.slice(0, pos), ...block, ...rest.slice(pos)];

    // path sequence unchanged (e.g. dropped onto its own row) → no-op
    const sameSequence =
      simulated.length === ordered.length &&
      simulated.every((entry, index) => entry.path === ordered[index]?.path);
    if (sameSequence) {
      this.deps.notifier.notice(
        this.deps.i18n.t("Nothing to move — the drop position is unchanged"),
      );
      return;
    }

    const tasks: WriteTask[] = [];
    simulated.forEach((entry, index) => {
      const target = normalizedOrder(index);
      if (entry.order === target) return;
      tasks.push(this.orderWrite(this.writableTarget(registry, entry.path), target));
    });
    if (tasks.length > 0) {
      const result = await this.deps.writer.run(tasks);
      this.reportFailures("moveFolder", result.failed);
    }

    this.deps.notifier.notice(
      this.deps.i18n.t("Folder moved — {n} notes reordered as one block", {
        n: block.length,
      }) +
        " → " +
        simulated
          .slice(0, 4)
          .map((entry) => entry.title)
          .join(" / "),
    );
    await this.scan();
    this.scheduleSettledScan();
    if (this.settings.autoRebuildIndex) {
      await this.rebuildIndex(root, { silent: true });
    } else {
      this.deps.store.markStale([root]);
    }
  }

  /**
   * Physically move a note into another folder of the same domain
   * (drag a file row onto a different folder row / out of a subfolder).
   * The vault rename is the source of truth; the order field travels
   * with the file and the domain is normalized afterwards.
   */
  async moveFileToFolder(
    root: DomainId,
    filePath: VaultPath,
    targetFolder: VaultPath,
  ): Promise<void> {
    const base = filePath.slice(filePath.lastIndexOf("/") + 1);
    let newPath = joinPath(targetFolder, base);
    for (let n = 1; this.deps.vault.exists(newPath); n++) {
      newPath = joinPath(targetFolder, base.replace(/(\.md)?$/, ` ${n}.md`));
    }
    await this.deps.vault.rename(filePath, newPath);
    this.deps.vault.noteRenamed(filePath, newPath);
    this.deps.notifier.notice(
      this.deps.i18n.t("✓ File moved to {folder}", { folder: targetFolder }),
    );
    await this.scan();
    this.scheduleSettledScan();
    if (this.settings.autoRebuildIndex) {
      await this.rebuildIndex(root, { silent: true });
    }
  }

  /** drag / move up / move down — the single everyday write path */
  async moveEntry(root: DomainId, path: VaultPath, targetIndex: number): Promise<void> {
    const registry = this.deps.store.getSnapshot();
    const domain = registry.domains.get(root);
    if (!domain) return;
    const plan = planInsert(domain.entries, path, targetIndex);
    const tasks: WriteTask[] = [...plan.writes].map(([p, value]) =>
      this.orderWrite(this.writableTarget(registry, p), value),
    );
    if (tasks.length > 0) {
      const result = await this.deps.writer.run(tasks);
      this.reportFailures("moveEntry", result.failed);
    }

    const t = this.deps.i18n.t.bind(this.deps.i18n);
    if (plan.normalized) {
      this.deps.notifier.notice(
        t("Gap too tight — reordered the whole domain, then placed the entry"),
      );
    } else if (tasks.length === 1) {
      this.deps.notifier.notice(
        t("Entry moved") +
          " — " +
          t("order = {order} · 1 file written (midpoint insert, Git diff minimal)", {
            order: plan.writes.get(path) ?? "",
          }),
      );
    }

    // rescan first so the rebuild renders the fresh chain
    await this.scan();
    this.scheduleSettledScan();
    if (this.settings.autoRebuildIndex) {
      await this.rebuildIndex(root, { silent: true });
    } else {
      this.deps.store.markStale([root]);
    }
  }

  /* ---------------- injection ---------------- */

  injectionTargets(): { notes: number; domains: number } {
    const registry = this.deps.store.getSnapshot();
    let notes = 0;
    for (const domain of registry.domains.values()) {
      notes += domain.entries.filter((entry) => entry.kind === "file").length;
    }
    return { notes, domains: registry.domains.size };
  }

  private gate(): InjectionGate | null {
    return openInjectionGate(this.settings.injectNavEnabled);
  }

  /** M2: enable flow with confirmation; returns the final gate state. */
  async enableInjection(): Promise<boolean> {
    const t = this.deps.i18n.t.bind(this.deps.i18n);
    const targets = this.injectionTargets();
    const choice = await this.deps.confirm.confirm({
      title: t("Turn on navigation injection"),
      body: t(
        "Chapter Trail will write a collapsible prev / next / index callout into <b>{n} notes</b> across {n2} domains. Each block is wrapped in <code>&lt;!-- chapter-trail:nav-* --&gt;</code> markers and can be removed anytime.",
        { n: targets.notes, n2: targets.domains },
      ),
      warn: t(
        "Batch writes run in chunks of 25 with a progress bar — you can cancel mid-run. Written files keep their content on cancel.",
      ),
      confirmLabel: t("Enable · write {n} notes", { n: targets.notes }),
      cancelLabel: t("Not now"),
    });
    if (!choice.confirmed) return this.settings.injectNavEnabled;

    this.settings.injectNavEnabled = true;
    await this.writeInjectionForAll();
    return true;
  }

  async writeInjectionForAll(): Promise<number> {
    const gate = this.gate();
    if (!gate) return 0;
    const registry = this.deps.store.getSnapshot();
    let written = 0;
    for (const domain of registry.domains.values()) {
      written += await this.writeInjectionFor(gate, domain, registry);
    }
    if (written > 0) {
      this.deps.notifier.notice(
        this.deps.i18n.t("✓ Injection enabled") +
          " — " +
          this.deps.i18n.t(
            "{n} notes written · wrapped in nav-begin/nav-end markers · removable anytime",
            { n: written },
          ),
      );
    }
    return written;
  }

  async rebuildInjection(root: DomainId): Promise<number> {
    const gate = this.gate();
    if (!gate) {
      // the command stays visible; tell the user why nothing happened
      this.deps.notifier.notice(
        this.deps.i18n.t("Navigation injection is off — turn it on in settings first"),
      );
      return 0;
    }
    const registry = this.deps.store.getSnapshot();
    const domain = registry.domains.get(root);
    if (!domain) return 0;
    const written = await this.writeInjectionFor(gate, domain, registry);
    this.deps.notifier.notice(this.deps.i18n.t("✓ Injection rebuilt"));
    return written;
  }

  /** One-click cleanup of a dissolved domain's leftover orders (PRD §2.5). */
  async clearLegacyOrders(paths: readonly VaultPath[]): Promise<number> {
    const tasks: WriteTask[] = paths.map((path) => ({
      path,
      apply: (raw) => {
        const patched = patchFrontmatter(raw, [{ op: "remove", key: PLUGIN_KEYS.order }], {
          parseYaml: this.deps.parseYaml,
        });
        return patched.ok ? patched.text : raw;
      },
    }));
    const result = await this.deps.writer.run(tasks);
    await this.scan();
    this.deps.notifier.notice(
      this.deps.i18n.t("✓ Legacy orders cleared") +
        " — " +
        this.deps.i18n.t("{n} file written · entries sorted by order · dead links removed", {
          n: result.written.length,
        }),
    );
    return result.written.length;
  }

  private async writeInjectionFor(
    gate: InjectionGate,
    domain: ManagedDomain,
    _registry: Registry,
  ): Promise<number> {
    const scope = this.filesInDomainScope(domain);
    const plan = buildInjectionPlan(gate, domain.entries, scope, { indexPath: domain.indexPath });
    const result = await this.deps.writer.run(plan.ops);
    return result.written.length;
  }

  private filesInDomainScope(domain: ManagedDomain): VaultPath[] {
    return this.deps.vault
      .listMarkdownFiles()
      .filter((path) => isUnder(path, domain.root))
      .filter((path) => path !== domain.indexPath);
  }

  async countInjectedNotes(): Promise<number> {
    let count = 0;
    for (const path of this.deps.vault.listMarkdownFiles()) {
      try {
        if (hasNavBlocks(await this.deps.vault.read(path))) count += 1;
      } catch {
        /* unreadable — ignore */
      }
    }
    return count;
  }

  async stripAllMarkers(): Promise<number> {
    // stripping is a removal path — the invariant's documented
    // exception (DESIGN §4.7): removal never adds injection content
    const gate = openInjectionGate(true);
    if (!gate) throw new Error("removal gate must mint");
    const paths = this.deps.vault.listMarkdownFiles();
    const plan = buildStripPlan(gate, paths);
    const result = await this.deps.writer.run(plan.ops);
    this.deps.notifier.notice(
      this.deps.i18n.t("All injected markers removed") +
        " — " +
        this.deps.i18n.t("Zero residue in notes · user-written callouts preserved"),
    );
    return result.written.length;
  }

  /* ---------------- conflicts ---------------- */

  async resolveNestedConflict(
    root: DomainId,
    conflictPath: VaultPath,
    choice: "demote" | "delete" | "exclude",
  ): Promise<void> {
    const t = this.deps.i18n.t.bind(this.deps.i18n);
    if (choice === "delete") {
      this.deps.ledger.registerAbsent(conflictPath);
      await this.deps.vault.trashFile(conflictPath);
    } else if (choice === "demote") {
      const raw = await this.deps.vault.read(conflictPath);
      const noBlock = removeIndexBlock(raw);
      const patched = patchFrontmatter(
        noBlock,
        [
          { op: "remove", key: PLUGIN_KEYS.isIndex },
          { op: "remove", key: PLUGIN_KEYS.mode },
        ],
        { parseYaml: this.deps.parseYaml },
      );
      const next = patched.ok ? patched.text : noBlock;
      this.deps.ledger.register(conflictPath, next);
      await this.deps.vault.process(conflictPath, () => next);
    } else {
      const registry = this.deps.store.getSnapshot();
      const domain = registry.domains.get(root);
      if (domain) {
        const folder = parentOf(conflictPath) ?? "";
        const rel = relativeInside(folder, root) ?? folder.slice(root.length + 1);
        const folderRef = rel.includes("/") ? (rel.split("/")[0] ?? rel) : rel;
        const merged = [...new Set([...domain.excludedFolders, folderRef])];
        const raw = await this.deps.vault.read(domain.indexPath);
        const patched = patchFrontmatter(
          raw,
          [{ op: "upsert", key: PLUGIN_KEYS.excludedFolders, value: merged }],
          { parseYaml: this.deps.parseYaml },
        );
        if (patched.ok) {
          this.deps.ledger.register(domain.indexPath, patched.text);
          await this.deps.vault.process(domain.indexPath, () => patched.text);
        }
      }
    }
    await this.scan();
    this.deps.notifier.notice(t("✓ Conflict resolved"));
  }

  /* ---------------- remove all (A8) ---------------- */

  async removeAllStep1Strip(): Promise<number> {
    return this.stripAllMarkers();
  }

  async removeAllStep2DeleteIndexes(roots: readonly DomainId[]): Promise<void> {
    const registry = this.deps.store.getSnapshot();
    for (const root of roots) {
      const domain = registry.domains.get(root);
      if (!domain) continue;
      this.deps.ledger.registerAbsent(domain.indexPath);
      await this.deps.vault.trashFile(domain.indexPath);
    }
    await this.scan();
  }

  async removeAllStep3ClearOrders(roots: readonly DomainId[]): Promise<number> {
    // the index pages may already be gone (step 2 dissolved the
    // domains), so scope by folder: every .md under each root
    const tasks: WriteTask[] = [];
    for (const root of roots) {
      for (const path of this.deps.vault.listMarkdownFiles()) {
        if (!isUnder(path, root)) continue;
        tasks.push({
          path,
          apply: (raw) => {
            const patched = patchFrontmatter(raw, [{ op: "remove", key: PLUGIN_KEYS.order }], {
              parseYaml: this.deps.parseYaml,
            });
            return patched.ok ? patched.text : raw;
          },
        });
      }
    }
    const result = await this.deps.writer.run(tasks);
    await this.scan();
    return result.written.length;
  }

  /** nearest series domain strictly containing the path, if any */
  private findEnclosingSeries(path: VaultPath): DomainId | null {
    const registry = this.deps.store.getSnapshot();
    let best: DomainId | null = null;
    for (const [root, domain] of registry.domains) {
      if (domain.mode !== "series" || root === path) continue;
      if (!isUnder(path, root)) continue;
      if (best === null || root.length > best.length) best = root;
    }
    return best;
  }

  /* ---------------- jumps ---------------- */

  gotoStep(step: "prev" | "next" | "index", activePath: VaultPath): boolean {
    const t = this.deps.i18n.t.bind(this.deps.i18n);
    const registry = this.deps.store.getSnapshot();
    let best: ManagedDomain | null = null;
    for (const domain of registry.domains.values()) {
      if (!isUnder(activePath, domain.root)) continue;
      if (!best || domain.root.length > best.root.length) best = domain;
    }
    if (!best) {
      this.deps.notifier.notice(t("No managed domain contains this note"));
      return false;
    }
    const files = best.entries.filter((entry) => entry.kind === "file");
    const index = files.findIndex((entry) => entry.path === activePath);
    if (index === -1) {
      this.deps.notifier.notice(t("No managed domain contains this note"));
      return false;
    }
    if (step === "index") {
      if (!this.deps.vault.exists(best.indexPath)) {
        this.deps.notifier.notice(t("The index page no longer exists"));
        return false;
      }
      this.deps.openFile(best.indexPath);
      return true;
    }
    const neighbor = files[step === "prev" ? index - 1 : index + 1];
    if (!neighbor) {
      this.deps.notifier.notice(
        t(
          step === "prev"
            ? "This is the first note in the chain"
            : "This is the last note in the chain",
        ),
      );
      return false;
    }
    this.deps.openFile(neighbor.path);
    return true;
  }
}
