/**
 * Browser verification harness — mounts the REAL PanelRoot with the
 * REAL PluginServices over a FakeVault so the two reported bugs can be
 * reproduced and verified in an actual browser (no Obsidian needed).
 * Built by scripts/build-harness.mjs into test/harness/harness.js.
 */
import { createRoot } from "react-dom/client";
import { ChunkedWriter } from "../../src/adapter/chunked-writer";
import { FakeVault } from "../../src/adapter/fake-vault";
import type {
  ConfirmPort,
  ConfirmResult,
  ConfirmSpec,
  NotifierPort,
} from "../../src/adapter/ports";
import { RegistryStore } from "../../src/adapter/registry-store";
import { EchoLedger } from "../../src/core/echo-ledger";
import { I18nService } from "../../src/i18n/runtime";
import { PluginServices } from "../../src/services";
import type { ChapterTrailSettings } from "../../src/settings";
import { DEFAULT_SETTINGS } from "../../src/settings";
import type { DomainId, DomainMode, VaultPath } from "../../src/types";
import { PanelRoot } from "../../src/ui/PanelRoot";
import type { PanelActions } from "../../src/ui/panel-actions";
import { FakeClock } from "../helpers";

function seedVault(): FakeVault {
  const vault = new FakeVault();
  const index = (mode: "series" | "independent", extra?: Record<string, unknown>): string =>
    `---\nis-index: true\nmode: ${mode}${extra ? `\norder: ${extra.order ?? ""}` : ""}\n---\n<!-- chapter-trail:begin -->\n<!-- chapter-trail:end -->\n`;
  vault.seed("Blogs/目录.md", index("series"));
  vault.seed(
    "Blogs/01 为什么选择 Quartz.md",
    "---\ncreated: 2025-11-02\norder: 10000\n---\n正文\n",
  );
  vault.seed("Blogs/02 环境搭建与部署.md", "---\ncreated: 2025-11-09\norder: 20000\n---\n正文\n");
  vault.seed("Blogs/03 配置详解.md", "---\ncreated: 2025-11-16\norder: 30000\n---\n正文\n");
  vault.seed("Blogs/进阶篇/04 插件机制.md", "---\ncreated: 2025-11-23\norder: 40000\n---\n正文\n");
  vault.seed("Blogs/进阶篇/05 主题定制.md", "---\ncreated: 2025-11-30\norder: 50000\n---\n正文\n");
  // unmanaged folder for the start-managing flow
  vault.seed("随笔/如何写一篇短文.md", "---\n---\n正文\n");
  vault.seed("随笔/数字花园的缓慢生长.md", "---\n---\n正文\n");
  vault.seed("随笔/周更的节奏.md", "---\n---\n正文\n");
  return vault;
}

async function main(): Promise<void> {
  const vault = seedVault();
  const clock = new FakeClock();
  const i18n = new I18nService("en");
  const settings: ChapterTrailSettings = { ...DEFAULT_SETTINGS };
  const notices: string[] = [];
  const confirmCalls: ConfirmSpec[] = [];
  const confirmPort: ConfirmPort = {
    confirm: (spec) => {
      confirmCalls.push(spec);
      const result: ConfirmResult = { confirmed: true };
      if (spec.options?.[0]) result.option = spec.options[0].id;
      return Promise.resolve(result);
    },
  };
  const notifier: NotifierPort = { notice: (message) => notices.push(message) };
  const ledger = new EchoLedger(clock, 5000);
  const writer = new ChunkedWriter(vault, clock, ledger);
  const store = new RegistryStore();
  const opened: VaultPath[] = [];
  const services = new PluginServices(
    {
      vault,
      clock,
      notifier,
      confirm: confirmPort,
      i18n,
      writer,
      ledger,
      store,
      openFile: (path) => opened.push(path),
    },
    settings,
  );

  const actions: PanelActions = {
    rescan: () => services.scan(),
    openSettings: () => notices.push("[settings]"),
    reviewLegacyOrders: (domain) => {
      const paths = store.getSnapshot().legacyOrders.get(domain) ?? [];
      void services.clearLegacyOrders(paths);
    },
    rebuildIndex: async (root) => {
      await services.rebuildIndex(root);
    },
    reindexOrder: async (root) => {
      await services.reindexOrder(root);
    },
    rebuildInjection: async (root) => {
      await services.rebuildInjection(root);
    },
    openIndexPage: (path) => opened.push(path),
    openFile: (path) => opened.push(path),
    copyDomainPath: (root) => notices.push(`[copy] ${root}`),
    stopManaging: async (root) => {
      await services.stopManaging(root, { clearOrder: false, stripNav: false });
    },
    resolveConflict: async (root, conflictPath) => {
      await services.resolveNestedConflict(root, conflictPath, "demote");
    },
    moveEntry: (root, path, targetIndex) => services.moveEntry(root, path, targetIndex),
    moveFolder: (root, folderPath, target) => services.moveFolder(root, folderPath, target),
    moveFileToFolder: (root, filePath, targetFolder) =>
      services.moveFileToFolder(root, filePath, targetFolder),
    startManagingWithModePicker: (folder) => services.startManaging(folder, "independent"),
    reorderDomains: () => Promise.resolve(),
    startManagingFlow: (folder: DomainId, mode: DomainMode) => services.startManaging(folder, mode),
    previewStartManaging: (folder) => services.previewStartManaging(folder),
    listFolderCandidates: () => {
      const registry = store.getSnapshot();
      const managedRoots = new Set(registry.domains.keys());
      const files = vault.listMarkdownFiles();
      const folders = vault.listFolders();
      const insideSeries = (folder: string): boolean => {
        for (const [root, domain] of registry.domains) {
          if (domain.mode !== "series") continue;
          if (folder !== root && folder.startsWith(`${root}/`)) return true;
        }
        return false;
      };
      return folders
        .map((folder) => {
          const prefix = folder === "" ? "" : `${folder}/`;
          const directFiles = files.filter(
            (path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"),
          );
          return {
            path: folder,
            noteCount: directFiles.length,
            subfolderCount: folders.filter(
              (other) => other.startsWith(prefix) && !other.slice(prefix.length).includes("/"),
            ).length,
            orderlessCount: directFiles.filter(
              (path) => vault.getFrontmatter(path)?.order === undefined,
            ).length,
            managed: managedRoots.has(folder),
          };
        })
        .filter(
          (candidate) =>
            !insideSeries(candidate.path) && (candidate.managed || candidate.noteCount > 0),
        )
        .sort((a, b) => a.path.localeCompare(b.path, "zh", { numeric: true }));
    },
  };

  await services.scan();
  const root = createRoot(document.getElementById("root") as HTMLElement);
  root.render(<PanelRoot store={store} i18n={i18n} settings={settings} actions={actions} />);

  (window as unknown as Record<string, unknown>).__ct = { vault, services, store, notices };
  (window as unknown as Record<string, unknown>).__ctOpened = opened;
  (window as unknown as Record<string, unknown>).__ctReady = true;
}

void main();
