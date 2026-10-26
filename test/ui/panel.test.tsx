// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RegistryStore } from "../../src/adapter/registry-store";
import { I18nService } from "../../src/i18n/runtime";
import { DEFAULT_SETTINGS } from "../../src/settings";
import type { ManagedDomain, Registry } from "../../src/types";
import { emptyRegistry } from "../../src/types";
import { PanelRoot } from "../../src/ui/PanelRoot";
import type { PanelActions } from "../../src/ui/panel-actions";

afterEach(() => cleanup());

const noopActions: PanelActions = {
  rescan: () => Promise.resolve(),
  openSettings: () => {},
  reviewLegacyOrders: () => {},
  rebuildIndex: () => Promise.resolve(),
  reindexOrder: () => Promise.resolve(),
  rebuildInjection: () => Promise.resolve(),
  openIndexPage: () => {},

  openFile: () => {},
  copyDomainPath: () => {},
  stopManaging: () => Promise.resolve(),
  resolveConflict: () => Promise.resolve(),
  moveEntry: () => Promise.resolve(),
  moveFolder: () => Promise.resolve(),
  moveFileToFolder: () => Promise.resolve(),
  startManagingWithModePicker: () => Promise.resolve(),
  reorderDomains: () => Promise.resolve(),
  startManagingFlow: () => Promise.resolve(),
  previewStartManaging: () => ({ missingOrderCount: 0, hasNameClash: false, existingOrders: 0 }),
  listFolderCandidates: () => [],
};

function domain(partial: Partial<ManagedDomain>): ManagedDomain {
  return {
    root: "Blogs",
    mode: "series",
    indexPath: "Blogs/目录.md",
    entries: [],
    unmanagedFolders: [],
    excludedFolders: [],
    status: {
      broken: [],
      conflicts: [],
      pending: [],
      stale: false,
      ties: [],
      tightGap: false,
      legacyHint: false,
    },
    ...partial,
  };
}

describe("PanelRoot (smoke)", () => {
  it("renders the summary, cards and the start-managing entry", () => {
    const store = new RegistryStore();
    const registry: Registry = {
      ...emptyRegistry(),
      domains: new Map([
        [
          "Blogs",
          domain({
            entries: [{ path: "Blogs/01.md", kind: "file", title: "01", order: 10000 }],
          }),
        ],
        [
          "随笔",
          domain({
            root: "随笔",
            mode: "independent",
            indexPath: "随笔/目录.md",
            status: {
              broken: [],
              conflicts: [],
              pending: ["随笔/new.md"],
              stale: true,
              ties: [],
              tightGap: false,
              legacyHint: false,
            },
          }),
        ],
      ]),
      legacyOrders: new Map([
        ["旧项目/周刊", Array.from({ length: 12 }, (_, i) => `旧项目/周刊/${i}.md`)],
      ]),
    };
    store.replace(registry);

    render(
      <PanelRoot
        store={store}
        i18n={new I18nService("en")}
        settings={{ ...DEFAULT_SETTINGS }}
        actions={noopActions}
      />,
    );

    expect(screen.getByText("2 domains · 1 needs attention")).toBeTruthy();
    expect(screen.getByText("Blogs")).toBeTruthy();
    expect(screen.getByText("Index outdated")).toBeTruthy();
    expect(screen.getByText("1 need ordering")).toBeTruthy();
    expect(screen.getByText(/12 legacy/)).toBeTruthy();
    expect(screen.getByText("＋ Start managing a folder")).toBeTruthy();
  });

  it("renders the conflict card state with Resolve…", () => {
    const store = new RegistryStore();
    store.replace({
      ...emptyRegistry(),
      domains: new Map([
        [
          "Blogs",
          domain({
            status: {
              broken: [],
              conflicts: [{ kind: "nested-index", path: "Blogs/进阶篇/目录.md" }],
              pending: [],
              stale: false,
              ties: [],
              tightGap: false,
              legacyHint: false,
            },
          }),
        ],
      ]),
    });
    render(
      <PanelRoot
        store={store}
        i18n={new I18nService("en")}
        settings={{ ...DEFAULT_SETTINGS }}
        actions={noopActions}
      />,
    );
    expect(screen.getByText("Nested index conflict")).toBeTruthy();
    expect(screen.getByText("Resolve…")).toBeTruthy();
  });
});
