/**
 * Command palette registration (DESIGN.md §4.9). Names are registered in
 * the language active at load; switching Language re-labels the panel and
 * settings immediately, and command labels follow after the next reload.
 */
import type { Plugin } from "obsidian";
import type { I18nService } from "./i18n/runtime";

export interface CommandHost {
  startManagingFolder(): Promise<void>;
  stopManagingFolder(): Promise<void>;
  rebuildIndexCurrent(): Promise<void>;
  rebuildIndexAll(): Promise<void>;
  reindexOrderCurrent(): Promise<void>;
  rebuildInjectionCurrent(): Promise<void>;
  removeAllData(): Promise<void>;
  gotoPrev(): Promise<void>;
  gotoNext(): Promise<void>;
  gotoIndex(): Promise<void>;
}

interface CommandSpec {
  id: string;
  nameKey: string;
  run: () => Promise<void>;
}

export function registerCommands(plugin: Plugin, i18n: I18nService, host: CommandHost): void {
  const specs: CommandSpec[] = [
    {
      id: "start-managing",
      nameKey: "Start managing current folder",
      run: () => host.startManagingFolder(),
    },
    {
      id: "stop-managing",
      nameKey: "Stop managing current folder",
      run: () => host.stopManagingFolder(),
    },
    {
      id: "rebuild-index-current",
      nameKey: "Rebuild index for current domain",
      run: () => host.rebuildIndexCurrent(),
    },
    { id: "rebuild-index-all", nameKey: "Rebuild all indexes", run: () => host.rebuildIndexAll() },
    {
      id: "reindex-order",
      nameKey: "Reindex order in current domain",
      run: () => host.reindexOrderCurrent(),
    },
    {
      id: "rebuild-injection",
      nameKey: "Rebuild injection in current domain",
      run: () => host.rebuildInjectionCurrent(),
    },
    {
      id: "remove-all",
      nameKey: "Remove all Chapter Trail data…",
      run: () => host.removeAllData(),
    },
    { id: "goto-prev", nameKey: "Go to previous note", run: () => host.gotoPrev() },
    { id: "goto-next", nameKey: "Go to next note", run: () => host.gotoNext() },
    {
      id: "goto-index",
      nameKey: "Open the index page of the current domain",
      run: () => host.gotoIndex(),
    },
  ];
  for (const spec of specs) {
    plugin.addCommand({
      id: spec.id,
      name: i18n.t(spec.nameKey),
      callback: () => {
        void spec.run().catch((error: unknown) => {
          console.error(`[chapter-trail] command ${spec.id} failed`, error);
        });
      },
    });
  }
}
