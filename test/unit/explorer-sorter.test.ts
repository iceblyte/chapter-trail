// @vitest-environment jsdom

import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExplorerSorter } from "../../src/adapter/explorer-sorter";
import { RegistryStore } from "../../src/adapter/registry-store";
import type { Registry } from "../../src/types";
import { emptyRegistry } from "../../src/types";

afterEach(() => cleanup());

function registryWith(entries: { path: string; kind: "file" | "managed-folder" }[]): Registry {
  return {
    ...emptyRegistry(),
    domains: new Map([
      [
        "Blogs",
        {
          root: "Blogs",
          mode: "series",
          indexPath: "Blogs/目录.md",
          entries: entries.map((entry) => ({ ...entry, title: entry.path })),
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
        },
      ],
    ]),
  };
}

/** DOM mimic of Obsidian's explorer tree (data-path attributes). */
function explorerTree(paths: string[]): void {
  const root = document.createElement("div");
  root.className = "tree-item";
  const rootSelf = document.createElement("div");
  rootSelf.className = "tree-item-self";
  rootSelf.setAttribute("data-path", "Blogs");
  root.appendChild(rootSelf);
  const container = document.createElement("div");
  container.className = "tree-item-children";
  for (const path of paths) {
    const item = document.createElement("div");
    item.className = "tree-item";
    const self = document.createElement("div");
    self.className = "tree-item-self";
    self.setAttribute("data-path", path);
    item.appendChild(self);
    container.appendChild(item);
  }
  root.appendChild(container);
  document.body.appendChild(root);
}

describe("ExplorerSorter — native file explorer order", () => {
  it("assigns flex order matching the chain; unranked go last", () => {
    const store = new RegistryStore();
    store.replace(
      registryWith([
        { path: "Blogs/02.md", kind: "file" },
        { path: "Blogs/01.md", kind: "file" },
        { path: "Blogs/进阶篇", kind: "managed-folder" },
      ]),
    );
    explorerTree(["Blogs/00.md", "Blogs/01.md", "Blogs/02.md", "Blogs/进阶篇"]);

    const sorter = new ExplorerSorter(
      {
        vault: {
          getAllLoadedFiles: () => [{ path: "Blogs", children: [] }, { path: "Blogs/01.md" }],
        },
        workspace: { on: () => ({}), offref: () => {} },
        metadataCache: { on: () => ({}), offref: () => {} },
      } as never,
      store,
    );
    sorter.apply();

    const container = document.querySelector(".tree-item-children") as HTMLElement;
    expect(container.style.display).toBe("flex");
    const orders = [...container.querySelectorAll(":scope > .tree-item")].map(
      (item) => (item as HTMLElement).style.order,
    );
    // 00.md unranked → after chain; 02 before 01 (chain rank); folder rank 2
    expect(orders).toEqual(["100000", "2", "1", "3"]);
  });

  it("ignores folders outside any managed domain", () => {
    const store = new RegistryStore();
    store.replace(registryWith([{ path: "Blogs/01.md", kind: "file" }]));
    // the explorer only shows 其他 — nothing matches any managed root
    document.body.innerHTML = "";
    explorerTree(["其他/01.md"]);
    // relabel the shell so it belongs to 其他, not Blogs
    const rootSelf = document.querySelector(".tree-item > .tree-item-self");
    rootSelf?.setAttribute("data-path", "其他");

    const sorter = new ExplorerSorter(
      {
        vault: { getAllLoadedFiles: () => [{ path: "其他", children: [] }] },
        workspace: { on: () => ({}), offref: () => {} },
        metadataCache: { on: () => ({}), offref: () => {} },
      } as never,
      store,
    );
    sorter.apply();
    const item = document.querySelector(".tree-item-children > .tree-item") as HTMLElement;
    expect(item.style.order).toBe("");
    const container = document.querySelector(".tree-item-children") as HTMLElement;
    expect(container.style.display).toBe("");
  });
});
