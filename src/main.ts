/**
 * Plugin entry point — assembly and dialog flows (DESIGN.md §2.1).
 * Everything domain-specific lives in PluginServices; this file wires
 * ports, settings hooks, commands and the M1–M6 confirmation dialogs
 * from prototype 05.
 */
import { parseYaml as obsidianParseYaml, Plugin } from "obsidian";
import { ChunkedWriter } from "./adapter/chunked-writer";
import { EventSource } from "./adapter/event-source";
import {
  ObsidianConfirmPort,
  ObsidianNotifierPort,
  ObsidianVaultAdapter,
  SystemClockPort,
} from "./adapter/obsidian-adapters";
import type { ClockPort, ConfirmPort, NotifierPort, VaultPort } from "./adapter/ports";
import { RegistryStore } from "./adapter/registry-store";
import { registerCommands } from "./commands";
import { ECHO_TTL_MS } from "./constants";
import { EchoLedger } from "./core/echo-ledger";
import type { Lang } from "./i18n/index";
import { I18nService } from "./i18n/runtime";
import { PluginServices } from "./services";
import { type ChapterTrailSettings, coerceSettings } from "./settings";
import { ChapterTrailSettingTab, type SettingsHooks, type SettingsTabHost } from "./settings-tab";
import type { DomainId, DomainMode, VaultPath } from "./types";
import type { PanelActions } from "./ui/panel-actions";
import { ChapterTrailPanelView, VIEW_TYPE_CHAPTER_TRAIL } from "./ui/panel-view";

export default class ChapterTrailPlugin extends Plugin implements SettingsTabHost, SettingsHooks {
  declare settings: ChapterTrailSettings;
  i18n!: I18nService;
  vaultAdapter!: ObsidianVaultAdapter;
  vaultPort!: VaultPort;
  clockPort!: ClockPort;
  notifierPort!: NotifierPort;
  confirmPort!: ConfirmPort;
  store!: RegistryStore;
  services!: PluginServices;
  private settingsTab: ChapterTrailSettingTab | null = null;
  private eventSource: EventSource | null = null;
  private cacheResolvedUnsub: (() => void) | undefined;
  readonly panelActions: PanelActions = {
    rescan: async () => {
      const startedAt = this.clockPort.now();
      await this.services.scan();
      const registry = this.store.getSnapshot();
      this.notifierPort.notice(
        `${this.i18n.t("Vault rescanned")} — ${this.i18n.t(
          "{n} managed domains · {n2} orphan index pages · {n3} markdown files · {s}s",
          {
            n: registry.domains.size,
            n2: registry.orphans.length,
            n3: this.vaultPort.listMarkdownFiles().length,
            s: ((this.clockPort.now() - startedAt) / 1000).toFixed(1),
          },
        )}`,
      );
    },
    openSettings: () => {
      const app = this.app as typeof this.app & {
        setting?: { open(): void; openTab(tab: ChapterTrailSettingTab): void };
      };
      app.setting?.open();
      if (this.settingsTab) app.setting?.openTab(this.settingsTab);
    },
    reviewLegacyOrders: async (domain) => {
      const paths = this.store.getSnapshot().legacyOrders.get(domain) ?? [];
      if (paths.length === 0) return;
      const t = this.i18n.t.bind(this.i18n);
      const choice = await this.confirmPort.confirm({
        title: t("Clear legacy orders?"),
        body: t(
          "This removes the <code>order</code> field from <b>{n} files</b> outside any managed domain. This cannot be undone except by reordering.",
          { n: paths.length },
        ),
        confirmLabel: t("Clear order in {n} files", { n: paths.length }),
        cancelLabel: t("Cancel"),
        confirmDanger: true,
      });
      if (!choice.confirmed) return;
      await this.services.clearLegacyOrders(paths);
    },
    rebuildIndex: async (root) => {
      await this.services.rebuildIndex(root);
    },
    reindexOrder: async (root) => {
      await this.services.reindexOrder(root);
    },
    rebuildInjection: async (root) => {
      await this.services.rebuildInjection(root);
    },
    openIndexPage: (path) => this.openFileInEditor(path),
    copyDomainPath: (root) => {
      void navigator.clipboard?.writeText(root);
      this.notifierPort.notice(`${this.i18n.t("Domain path copied")} — ${root}`);
    },
    stopManaging: (root) => this.stopManagingFlow(root),
    resolveConflict: (root, conflictPath) => this.resolveConflictFlow(root, conflictPath),
    moveEntry: (root, path, targetIndex) => this.services.moveEntry(root, path, targetIndex),
    startManagingFlow: (folder, mode) => this.services.startManaging(folder, mode),
    previewStartManaging: (folder) => this.services.previewStartManaging(folder),
    listFolderCandidates: () => {
      const managedRoots = new Set(this.store.getSnapshot().domains.keys());
      const files = this.vaultPort.listMarkdownFiles();
      const folders = this.vaultPort.listFolders();
      return folders
        .map((folder) => {
          const directPrefix = folder === "" ? "" : `${folder}/`;
          const directFiles = files.filter(
            (path) =>
              path.startsWith(directPrefix) && !path.slice(directPrefix.length).includes("/"),
          );
          const subfolderCount = folders.filter(
            (other) =>
              other.startsWith(directPrefix) && !other.slice(directPrefix.length).includes("/"),
          ).length;
          const orderlessCount = directFiles.filter((path) => {
            const fm = this.vaultPort.getFrontmatter(path);
            return fm?.order === undefined && fm?.["is-index"] !== true;
          }).length;
          return {
            path: folder,
            noteCount: directFiles.length,
            subfolderCount,
            orderlessCount,
            managed: managedRoots.has(folder),
          };
        })
        .filter((candidate) => candidate.managed || candidate.noteCount > 0)
        .sort((a, b) => a.path.localeCompare(b.path, "zh", { numeric: true }));
    },
  };

  async onload(): Promise<void> {
    await this.loadSettings();
    this.i18n = new I18nService(this.settings.language);

    this.vaultAdapter = new ObsidianVaultAdapter(this.app);
    this.vaultPort = this.vaultAdapter;
    this.clockPort = new SystemClockPort();
    this.notifierPort = new ObsidianNotifierPort();
    this.confirmPort = new ObsidianConfirmPort(this.app);
    this.store = new RegistryStore();

    const ledger = new EchoLedger(this.clockPort, ECHO_TTL_MS);
    const writer = new ChunkedWriter(this.vaultPort, this.clockPort, ledger);
    this.services = new PluginServices(
      {
        vault: this.vaultPort,
        clock: this.clockPort,
        notifier: this.notifierPort,
        confirm: this.confirmPort,
        i18n: this.i18n,
        writer,
        ledger,
        store: this.store,
        parseYaml: (text: string) => obsidianParseYaml(text),
        openFile: (path) => this.openFileInEditor(path),
      },
      this.settings,
    );

    const tab = new ChapterTrailSettingTab(this, this.i18n, this);
    tab.attachLangListener();
    this.addSettingTab(tab);
    this.settingsTab = tab;

    this.registerView(
      VIEW_TYPE_CHAPTER_TRAIL,
      (leaf) =>
        new ChapterTrailPanelView(leaf, {
          store: this.store,
          i18n: this.i18n,
          settings: this.settings,
          actions: this.panelActions,
        }),
    );
    this.addRibbonIcon("list-ordered", "Chapter Trail", () => {
      void this.activatePanel();
    });

    registerCommands(this, this.i18n, {
      startManagingFolder: () => this.commandStartManaging(),
      stopManagingFolder: () => this.commandStopManaging(),
      rebuildIndexCurrent: () =>
        this.commandForActiveDomain((root) => this.services.rebuildIndex(root)),
      rebuildIndexAll: async () => {
        await this.services.rebuildAllIndexes();
      },
      reindexOrderCurrent: () =>
        this.commandForActiveDomain((root) => this.services.reindexOrder(root)),
      rebuildInjectionCurrent: () =>
        this.commandForActiveDomain((root) => this.services.rebuildInjection(root)),
      removeAllData: () => this.removeAllWizard(),
      gotoPrev: () => this.commandGoto("prev"),
      gotoNext: () => this.commandGoto("next"),
      gotoIndex: () => this.commandGoto("index"),
    });

    /* startup scan: metadataCache may or may not be warm yet */
    void this.services.scan();
    this.cacheResolvedUnsub = this.vaultAdapter.onCacheResolved(() => {
      void this.services.scan();
    });

    this.eventSource = new EventSource(this.vaultPort, this.clockPort, ledger);
    this.eventSource.start((events) => this.services.handleExternalBatch(events));
  }

  onunload(): void {
    this.eventSource?.stop();
    this.eventSource = null;
    this.cacheResolvedUnsub?.();
    this.vaultAdapter.dispose();
    this.store.clear();
  }

  async loadSettings(): Promise<void> {
    this.settings = coerceSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private openFileInEditor(path: VaultPath): void {
    const file = this.app.vault.getFileByPath(path);
    if (file) void this.app.workspace.getLeaf(false).openFile(file);
  }

  async activatePanel(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_CHAPTER_TRAIL);
    const leaf = existing[0] ?? workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_CHAPTER_TRAIL, active: true });
    workspace.revealLeaf(leaf);
  }

  private activeFilePath(): VaultPath | null {
    return this.app.workspace.getActiveFile()?.path ?? null;
  }

  private activeFolder(): DomainId | null {
    const path = this.activeFilePath();
    if (!path) return null;
    const folder = path.slice(0, path.lastIndexOf("/"));
    return folder === "" ? null : folder; // vault root cannot be managed
  }

  private async commandForActiveDomain(
    action: (root: DomainId) => Promise<unknown>,
  ): Promise<void> {
    const path = this.activeFilePath();
    if (!path) return;
    const domain = this.services.domainContaining(path);
    if (!domain) {
      this.notifierPort.notice(this.i18n.t("No managed domain contains this note"));
      return;
    }
    await action(domain.root);
  }

  private commandGoto(step: "prev" | "next" | "index"): Promise<void> {
    const path = this.activeFilePath();
    if (!path) return Promise.resolve();
    this.services.gotoStep(step, path);
    return Promise.resolve();
  }

  /* ---------------- start / stop managing ---------------- */

  private async commandStartManaging(): Promise<void> {
    const folder = this.activeFolder();
    if (!folder) {
      this.notifierPort.notice(
        this.i18n.t("Open a note inside a folder first — the vault root cannot be managed"),
      );
      return;
    }
    if (this.store.getSnapshot().domains.has(folder)) {
      this.notifierPort.notice(`${this.i18n.t("already managed")} — ${folder}`);
      return;
    }
    await this.startManagingFlow(folder);
  }

  /** The two-step flow from prototype 04 (folder pre-picked by caller). */
  async startManagingFlow(folder: DomainId): Promise<void> {
    const _t = this.i18n.t.bind(this.i18n);
    const preview = this.services.previewStartManaging(folder);
    const mode = await this.chooseModeDialog(folder, preview);
    if (!mode) return;
    await this.services.startManaging(folder, mode);
  }

  private async chooseModeDialog(
    folder: DomainId,
    _preview: { missingOrderCount: number; hasNameClash: boolean },
  ): Promise<DomainMode | null> {
    const t = this.i18n.t.bind(this.i18n);
    const result = await this.confirmPort.confirm({
      title: `${t("Choose a mode")} · ${t("· Step 2 of 2")}`,
      body: t("Mode for <b>{folder}</b> — one managed domain, one chain style:", { folder }),
      options: [
        {
          id: "independent",
          label: t("Independent · default"),
          description: t(
            "Direct notes and managed subfolders mix in one ordering. Each managed subfolder keeps its own chain. Best for loosely related notes.",
          ),
        },
        {
          id: "series",
          label: "Series",
          description: t(
            "One chain across the whole subtree; subfolders become path labels only. Best for tutorials and serials.",
          ),
        },
      ],
      selectedOption: "independent",
      warn: t(
        "Creates <b>{indexFile}.md</b> with <code>is-index: true</code> and a plugin-owned marked block. Recognition is by the marker, not the file name — you can rename the file later. Mode is stored in the index page’s frontmatter and can be switched any time.",
        { indexFile: this.settings.indexFileName },
      ),
      confirmLabel: t("Start managing"),
      cancelLabel: t("Cancel"),
    });
    if (!result.confirmed || !result.option) return null;
    return result.option === "series" ? "series" : "independent";
  }

  private async commandStopManaging(): Promise<void> {
    const path = this.activeFilePath();
    if (!path) return;
    const domain = this.services.domainContaining(path);
    if (!domain) return;
    await this.stopManagingFlow(domain.root);
  }

  /** M5 (prototype 05): delete index + optional order / nav cleanup. */
  async stopManagingFlow(root: DomainId): Promise<void> {
    const t = this.i18n.t.bind(this.i18n);
    const domain = this.store.getSnapshot().domains.get(root);
    if (!domain) return;
    const noteCount = domain.entries.filter((entry) => entry.kind === "file").length;
    const result = await this.confirmPort.confirm({
      title: t("Stop managing this folder?"),
      body: t(
        "Deleting <b>{indexFile}.md</b> dissolves the domain <b>{domain}</b>. The ordering data lives in each note’s frontmatter and will remain unless you clear it below.",
        {
          indexFile: this.settings.indexFileName,
          domain: root,
        },
      ),
      checkboxes: [
        {
          id: "clearOrder",
          label: `${t("Also clear <code>order</code> fields")} (${t("({n} notes)", { n: noteCount })})`,
        },
        {
          id: "stripNav",
          label: `${t("Also remove injected navigation")} (${t("({n} notes)", { n: noteCount })})`,
        },
      ],
      confirmLabel: t("Delete index & stop"),
      cancelLabel: t("Cancel"),
      confirmDanger: true,
    });
    if (!result.confirmed) return;
    await this.services.stopManaging(root, {
      clearOrder: result.checked?.includes("clearOrder") ?? false,
      stripNav: result.checked?.includes("stripNav") ?? false,
    });
    this.notifierPort.notice(
      t("✓ Domain dissolved") +
        " — " +
        t(
          "{indexFile}.md deleted · remaining order fields (if any) will surface in the vault banner",
          { indexFile: this.settings.indexFileName },
        ),
    );
  }

  /* ---------------- remove-all wizard (M6, prototype 05) ---------------- */

  async removeAllWizard(): Promise<void> {
    const t = this.i18n.t.bind(this.i18n);
    const roots = [...this.store.getSnapshot().domains.keys()];
    if (roots.length === 0) {
      this.notifierPort.notice(t("No managed domain contains this note"));
      return;
    }
    let step = 1;
    let deleteRoots: DomainId[] = [];
    let clearRoots: DomainId[] = [];
    for (;;) {
      if (step === 1) {
        const result = await this.confirmPort.confirm({
          title: `${t("Remove all Chapter Trail data")} · ${t("· Step 1 of 3")}`,
          body: t(
            "① Strip injected navigation — removes everything inside <code>chapter-trail:nav-begin/end</code> markers across {n} domains. Your own callouts are never touched.",
            { n: roots.length },
          ),
          confirmLabel: t("Next"),
          cancelLabel: t("Cancel"),
          confirmDanger: true,
        });
        if (!result.confirmed) return;
        step = 2;
      } else if (step === 2) {
        const result = await this.confirmPort.confirm({
          title: `${t("Remove all Chapter Trail data")} · ${t("· Step 2 of 3")}`,
          body: t(
            "② Delete index pages — confirm per domain. Dissolved domains lose their auto-maintained index; the pages are plain Markdown and stay readable otherwise.",
          ),
          checkboxes: roots.map((root) => ({
            id: root,
            label: `${root} ${t("({n} notes)", {
              n: this.store.getSnapshot().domains.get(root)?.entries.length ?? 0,
            })}`,
          })),
          confirmLabel: t("Next"),
          cancelLabel: t("Back"),
          confirmDanger: true,
        });
        if (!result.confirmed) {
          step = 1;
          continue;
        }
        deleteRoots = result.checked ?? [];
        step = 3;
      } else {
        const result = await this.confirmPort.confirm({
          title: `${t("Remove all Chapter Trail data — step {n} of 3", { n: 3 })}`,
          body: t("③ Clear <code>order</code> fields — confirm per domain."),
          danger: t(
            "This removes <b>all</b> <code>order</code> fields in each confirmed domain — including any not created by Chapter Trail. This cannot be undone except by reordering.",
          ),
          checkboxes: roots.map((root) => ({
            id: root,
            label: `${root} ${t("({n} notes)", {
              n: this.store.getSnapshot().domains.get(root)?.entries.length ?? 0,
            })}`,
          })),
          confirmLabel: t("Finish"),
          cancelLabel: t("Back"),
          confirmDanger: true,
        });
        if (!result.confirmed) {
          step = 2;
          continue;
        }
        clearRoots = result.checked ?? [];
        break;
      }
    }

    await this.services.removeAllStep1Strip();
    await this.services.removeAllStep2DeleteIndexes(deleteRoots);
    await this.services.removeAllStep3ClearOrders(clearRoots);
    this.notifierPort.notice(
      t("✓ Chapter Trail data removed") +
        " — " +
        t(
          "stripped injections · deleted confirmed index pages · cleared confirmed order fields · everything else untouched",
        ),
    );
  }

  /* ---------------- M4: nested-index conflict ---------------- */

  async resolveConflictFlow(root: DomainId, conflictPath: VaultPath): Promise<void> {
    const t = this.i18n.t.bind(this.i18n);
    const result = await this.confirmPort.confirm({
      title: t("Nested index page detected"),
      body: t(
        "<b>{path}</b> has <code>is-index: true</code>, but its folder is inside the series domain <b>{domain}</b>. Choose how to resolve:",
        { path: conflictPath, domain: root },
      ),
      options: [
        {
          id: "demote",
          label: t("Demote to a normal note"),
          description: t(
            "Remove <code>is-index</code> and the marked block; the file itself is kept.",
          ),
        },
        { id: "delete", label: t("Delete the file"), description: t("Move to system trash.") },
        {
          id: "exclude",
          label: t("Exclude the folder"),
          description: t("Add <code>{folder}</code> to excluded-folders; the domain ignores it.", {
            folder: conflictPath.slice(0, conflictPath.lastIndexOf("/")),
          }),
        },
      ],
      selectedOption: "demote",
      confirmLabel: t("Apply"),
      cancelLabel: t("Cancel"),
    });
    if (!result.confirmed || !result.option) return;
    const choice =
      result.option === "delete" ? "delete" : result.option === "exclude" ? "exclude" : "demote";
    await this.services.resolveNestedConflict(root, conflictPath, choice);
  }

  /* ---------------- SettingsHooks ---------------- */

  async onIndexFileNameChange(name: string): Promise<string> {
    const effective = name.trim() === "" ? this.settings.indexFileName : name.trim();
    if (effective !== this.settings.indexFileName) {
      this.settings.indexFileName = effective;
      await this.saveSettings();
      this.store.markStale([...this.store.getSnapshot().domains.keys()]);
      this.notifierPort.notice(
        this.i18n.t("Index file name updated") +
          " — " +
          this.i18n.t(
            "New pages will use “{indexFile}” · affected domains marked “Index outdated” · nothing renamed",
            { indexFile: effective },
          ),
      );
    }
    return effective;
  }

  async onDateDisplayChange(mode: ChapterTrailSettings["dateDisplay"]): Promise<void> {
    this.settings.dateDisplay = mode;
    await this.saveSettings();
    const roots = [...this.store.getSnapshot().domains.keys()];
    this.store.markStale(roots);
    this.notifierPort.notice(
      this.i18n.t("Date display: {mode}", { mode }) +
        " — " +
        this.i18n.t("{n} domains marked “Index outdated” — rebuild their index pages to apply", {
          n: roots.length,
        }),
    );
  }

  async onAutoRebuildChange(enabled: boolean): Promise<void> {
    await this.saveSettings();
    this.notifierPort.notice(
      this.i18n.t("Auto-rebuild is now {state}", { state: this.i18n.t(enabled ? "on" : "off") }),
    );
  }

  async onInjectionToggle(next: boolean): Promise<boolean> {
    if (next) {
      const finalState = await this.services.enableInjection();
      await this.saveSettings();
      return finalState;
    }
    this.settings.injectNavEnabled = false;
    await this.saveSettings();
    return false;
  }

  async countInjectedNotes(): Promise<number> {
    return this.services.countInjectedNotes();
  }

  async stripAllMarkers(): Promise<void> {
    await this.services.stripAllMarkers();
  }

  async onLanguageChange(lang: Lang): Promise<void> {
    this.settings.language = lang;
    await this.saveSettings();
    this.i18n.setLang(lang);
  }

  openRemoveAllWizard(): void {
    void this.removeAllWizard();
  }
}
