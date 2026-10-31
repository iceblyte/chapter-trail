import { describe, expect, it } from "vitest";
import { INDEX_BLOCK_BEGIN, INDEX_BLOCK_END, NAV_BLOCK_BEGIN } from "../../src/constants";
import { hasNavBlocks } from "../../src/core/block-codec";
import type { VaultPath } from "../../src/types";
import { type Harness, indexPageContent, makeHarness, note, orderOf } from "../helpers";

function seedSeriesVault(harness: Harness): void {
  const { vault } = harness;
  vault.seed("Blogs/目录.md", indexPageContent("series"));
  vault.seed("Blogs/01 为什么选择 Quartz.md", note(10000, { created: "2025-11-02" }));
  vault.seed("Blogs/02 环境搭建与部署.md", note(20000, { created: "2025-11-09" }));
  vault.seed("Blogs/进阶篇/03 配置详解.md", note(30000, { created: "2025-11-16" }));
  vault.seed("Blogs/进阶篇/04 插件机制.md", note(40000, { created: "2025-11-23" }));
  vault.seed("Blogs/进阶篇/05 主题定制.md", note(50000, { created: "2025-11-30" }));
}

describe("A1 — independent index rebuild", () => {
  it("mixes direct files and managed subfolders; unmanaged trail as text", async () => {
    const h = makeHarness();
    const { vault } = h;
    vault.seed("读书/目录.md", indexPageContent("independent"));
    vault.seed("读书/引言：卢曼的盒子.md", note(10000, { created: "2025-09-14" }));
    vault.seed("读书/第一部分/目录.md", indexPageContent("independent", { order: 20000 }));
    vault.seed("读书/第一部分/01.md", note(10000));
    vault.seed("读书/卡片的三种类型.md", note(30000, { created: "2025-09-28" }));
    vault.seed("读书/参考资料/note.md", note());
    await h.services.scan();
    await h.services.rebuildIndex("读书");
    const index = vault.readContent("读书/目录.md");
    // the managed subfolder nests its own entries underneath (bug 10);
    // top-level entries get blank lines, children hug their folder,
    // dates sit after an em dash (round 18 layout)
    expect(index).toBe(
      [
        "---",
        "is-index: true",
        "mode: independent",
        "---",
        "",
        INDEX_BLOCK_BEGIN,
        "- [引言：卢曼的盒子](引言：卢曼的盒子.md) — 2025-09-14",
        "",
        "- [第一部分](第一部分/目录.md)",
        "    - [01](第一部分/01.md)",
        "",
        "- [卡片的三种类型](卡片的三种类型.md) — 2025-09-28",
        "",
        "- 参考资料",
        INDEX_BLOCK_END,
        "",
      ].join("\n"),
    );
  });

  it("a series subdomain nests its whole indented tree under the folder link", async () => {
    const h = makeHarness({ indexShowCreated: false, indexShowUpdated: true });
    const { vault } = h;
    vault.seed("A/目录.md", indexPageContent("independent"));
    vault.seed("A/B/目录.md", indexPageContent("series", { order: 20000 }));
    vault.seed("A/B/b1.md", note(10000, { created: "2026-08-28" }));
    vault.seed("A/B/b2.md", note(20000));
    vault.seed("A/B/子/b3.md", note(30000, { updated: "2026-09-04 23:40" }));
    await h.services.scan();
    await h.services.rebuildIndex("A");
    const inner = vault.readContent("A/目录.md").split(INDEX_BLOCK_BEGIN)[1] ?? "";
    expect(inner.split(INDEX_BLOCK_END)[0]?.trim()).toBe(
      [
        "- [B](B/目录.md)",
        "    - [b1](B/b1.md)",
        "    - [b2](B/b2.md)",
        "    - **子**",
        "        - [b3](B/子/b3.md) — 2026-09-04 23:40",
      ].join("\n"),
    );
  });
});

describe("A2 — series chain and navigation", () => {
  it("chains the whole subtree; first/last omit slots; overview hits root index", async () => {
    const h = makeHarness({ injectNavEnabled: true });
    seedSeriesVault(h);
    await h.services.scan();
    await h.services.writeInjectionForAll();

    const first = h.vault.readContent("Blogs/01 为什么选择 Quartz.md");
    expect(first).toContain(`${NAV_BLOCK_BEGIN}`);
    expect(first).toContain(
      "> [!chapter-trail]- 总览：[目录](目录.md) | 下一篇：[02 环境搭建与部署](02%20环境搭建与部署.md)",
    );
    expect(first).not.toContain("上一篇：");

    const middle = h.vault.readContent("Blogs/进阶篇/03 配置详解.md");
    expect(middle).toContain("上一篇：[02 环境搭建与部署](../02%20环境搭建与部署.md)");
    expect(middle).toContain("总览：[目录](../目录.md)");
    expect(middle).toContain("下一篇：[04 插件机制](04%20插件机制.md)");

    const last = h.vault.readContent("Blogs/进阶篇/05 主题定制.md");
    expect(last).not.toContain("下一篇：");
    expect(last).toContain("总览：[目录](../目录.md)");
  });
});

describe("A3 — injection gate lifecycle", () => {
  it("gate closed: ordering and index operations leave zero nav markers", async () => {
    const h = makeHarness(); // injectNavEnabled defaults to false
    seedSeriesVault(h);
    await h.services.scan();
    await h.services.reindexOrder("Blogs");
    await h.services.rebuildIndex("Blogs");
    await h.services.moveEntry("Blogs", "Blogs/02 环境搭建与部署.md", 3);

    for (const path of h.vault.listMarkdownFiles()) {
      expect(hasNavBlocks(h.vault.readContent(path)), path).toBe(false);
    }
  });

  it("enable writes wrappers; disable+strip leaves zero residue", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    await h.services.scan();

    h.settings.injectNavEnabled = true;
    await h.services.writeInjectionForAll();
    expect(hasNavBlocks(h.vault.readContent("Blogs/02 环境搭建与部署.md"))).toBe(true);

    // user callout inside a note survives the strip
    const withUserCallout = "Blogs/进阶篇/03 配置详解.md";
    h.vault.write(
      withUserCallout,
      `${h.vault.readContent(withUserCallout)}\n> [!note]- 我自己写的\n内容\n`,
    );

    h.settings.injectNavEnabled = false;
    const before = h.vault.snapshot();
    await h.services.stripAllMarkers();

    for (const [path, content] of h.vault.snapshot()) {
      expect(hasNavBlocks(content), path).toBe(false);
    }
    // the user's own callout (written after the bottom block) survives
    expect(h.vault.readContent(withUserCallout)).toContain("我自己写的");
    // the index page was never touched
    expect(h.vault.readContent("Blogs/目录.md")).toBe(before.get("Blogs/目录.md"));
  });
});

describe("A4 — delete a chain member", () => {
  it("flags broken, rebuild removes the dead link, injection reconnects", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    await h.services.scan();
    await h.services.rebuildIndex("Blogs");
    expect(h.vault.readContent("Blogs/目录.md")).toContain(
      "[04 插件机制](进阶篇/04%20插件机制.md)",
    );

    h.vault.trashFile("Blogs/进阶篇/04 插件机制.md");
    await h.services.handleExternalBatch([{ type: "delete", path: "Blogs/进阶篇/04 插件机制.md" }]);

    const afterDelete = h.store.getSnapshot().domains.get("Blogs");
    expect(afterDelete?.status.broken).toContain("Blogs/进阶篇/04 插件机制.md");

    await h.services.rebuildIndex("Blogs");
    const rebuilt = h.vault.readContent("Blogs/目录.md");
    expect(rebuilt).not.toContain("04 插件机制");
    expect(h.store.getSnapshot().domains.get("Blogs")?.status.broken).toEqual([]);

    h.settings.injectNavEnabled = true;
    await h.services.rebuildInjection("Blogs");
    const neighbor = h.vault.readContent("Blogs/进阶篇/03 配置详解.md");
    expect(neighbor).toContain("下一篇：[05 主题定制](05%20主题定制.md)");
  });
});

describe("A5 — move a note out of the domain", () => {
  it("clears order + nav automatically; origin flagged stale; target pending", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    await h.services.scan();
    h.settings.injectNavEnabled = true;
    await h.services.writeInjectionForAll();
    expect(hasNavBlocks(h.vault.readContent("Blogs/02 环境搭建与部署.md"))).toBe(true);

    await h.vault.rename("Blogs/02 环境搭建与部署.md", "草稿/02 环境搭建与部署.md");
    await h.services.handleExternalBatch([
      { type: "rename", path: "草稿/02 环境搭建与部署.md", oldPath: "Blogs/02 环境搭建与部署.md" },
    ]);

    const moved = h.vault.readContent("草稿/02 环境搭建与部署.md");
    expect(orderOf(h, "草稿/02 环境搭建与部署.md")).toBeUndefined();
    expect(hasNavBlocks(moved)).toBe(false);
    expect(h.store.getSnapshot().domains.get("Blogs")?.status.stale).toBe(true);
  });
});

describe("A5b — moving a managed folder keeps every order (bug 12)", () => {
  it("series domain moved into another folder re-roots instead of clearing order", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    await h.services.scan();
    expect(h.store.getSnapshot().domains.has("Blogs")).toBe(true);

    // the user drags Blogs into 随笔 in the file explorer: Obsidian fires
    // a rename for the folder AND one per child file
    h.vault.seedFolder("随笔");
    h.vault.moveFolder("Blogs", "随笔/Blogs");
    await h.services.handleExternalBatch([...h.vault.events]);

    // orders travel with the files — none was wiped
    expect(orderOf(h, "随笔/Blogs/01 为什么选择 Quartz.md")).toBe(10000);
    expect(orderOf(h, "随笔/Blogs/02 环境搭建与部署.md")).toBe(20000);
    expect(orderOf(h, "随笔/Blogs/进阶篇/05 主题定制.md")).toBe(50000);

    // the domain re-rooted to the new location with the same chain
    const domain = h.store.getSnapshot().domains.get("随笔/Blogs");
    expect(domain?.mode).toBe("series");
    expect(domain?.indexPath).toBe("随笔/Blogs/目录.md");
    expect(domain?.entries.map((entry) => entry.title)).toEqual([
      "01 为什么选择 Quartz",
      "02 环境搭建与部署",
      "03 配置详解",
      "04 插件机制",
      "05 主题定制",
    ]);
    expect(h.store.getSnapshot().domains.has("Blogs")).toBe(false);
  });

  it("the re-rooted domain stays fully operational (drag still writes midpoints)", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    await h.services.scan();
    h.vault.seedFolder("随笔");
    h.vault.moveFolder("Blogs", "随笔/Blogs");
    await h.services.handleExternalBatch([...h.vault.events]);

    await h.services.moveEntry("随笔/Blogs", "随笔/Blogs/02 环境搭建与部署.md", 2);
    // lands between 03 (30000) and 04 (40000) → midpoint
    expect(orderOf(h, "随笔/Blogs/02 环境搭建与部署.md")).toBe(35000);
  });

  it("a single file moved out still clears its order (original behavior)", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    await h.services.scan();
    h.vault.seedFolder("草稿");
    await h.vault.rename("Blogs/01 为什么选择 Quartz.md", "草稿/01 为什么选择 Quartz.md");
    await h.services.handleExternalBatch([
      {
        type: "rename",
        path: "草稿/01 为什么选择 Quartz.md",
        oldPath: "Blogs/01 为什么选择 Quartz.md",
      },
    ]);
    expect(orderOf(h, "草稿/01 为什么选择 Quartz.md")).toBeUndefined();
    // untouched siblings keep theirs
    expect(orderOf(h, "Blogs/02 环境搭建与部署.md")).toBe(20000);
  });
});

describe("A6 — ties and reindex", () => {
  it("ties fall back to filename order; reindex normalizes to 10000 steps", async () => {
    const h = makeHarness();
    h.vault.seed("随笔/目录.md", indexPageContent("series"));
    h.vault.seed("随笔/周记 10.md", note(20000));
    h.vault.seed("随笔/周记 2.md", note(20000));
    h.vault.seed("随笔/周记 1.md", note(10000));
    await h.services.scan();

    const domain = h.store.getSnapshot().domains.get("随笔");
    expect(domain?.entries.map((entry) => entry.title)).toEqual(["周记 1", "周记 2", "周记 10"]);
    expect(new Set(domain?.status.ties ?? [])).toEqual(
      new Set(["随笔/周记 2.md", "随笔/周记 10.md"]),
    );

    await h.services.reindexOrder("随笔");
    expect(orderOf(h, "随笔/周记 1.md")).toBe(10000);
    expect(orderOf(h, "随笔/周记 2.md")).toBe(20000);
    expect(orderOf(h, "随笔/周记 10.md")).toBe(30000);
    // chain order preserved
    const after = h.store.getSnapshot().domains.get("随笔");
    expect(after?.entries.map((entry) => entry.title)).toEqual(["周记 1", "周记 2", "周记 10"]);
  });
});

describe("A7 — nested index conflict resolution", () => {
  it("flags the conflict; all three resolutions work", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    await h.services.scan();

    /* demote variant */
    h.vault.seed("Blogs/进阶篇/目录.md", `${indexPageContent("series")}正文\n`);
    await h.services.scan();
    const flagged = h.store.getSnapshot().domains.get("Blogs");
    expect(flagged?.status.conflicts.map((c) => c.kind)).toContain("nested-index");
    const conflictPath = flagged?.status.conflicts[0]?.path;
    if (conflictPath) await h.services.resolveNestedConflict("Blogs", conflictPath, "demote");
    expect(h.store.getSnapshot().domains.get("Blogs")?.status.conflicts).toEqual([]);
    expect(h.vault.getFrontmatter("Blogs/进阶篇/目录.md")?.["is-index"]).not.toBe(true);
    expect(h.vault.readContent("Blogs/进阶篇/目录.md")).not.toContain(INDEX_BLOCK_BEGIN);

    /* exclude-the-folder variant (fresh folder — the excluded one no longer conflicts) */
    h.vault.seed("Blogs/草稿箱/目录.md", `${indexPageContent("series")}正文\n`);
    await h.services.scan();
    const again = h.store.getSnapshot().domains.get("Blogs")?.status.conflicts[0]?.path;
    if (again) await h.services.resolveNestedConflict("Blogs", again, "exclude");
    expect(h.store.getSnapshot().domains.get("Blogs")?.status.conflicts).toEqual([]);
    expect(h.store.getSnapshot().domains.get("Blogs")?.excludedFolders).toContain("草稿箱");

    /* delete variant */
    h.vault.seed("Blogs/归档/目录.md", `${indexPageContent("series")}正文\n`);
    await h.services.scan();
    const third = h.store.getSnapshot().domains.get("Blogs")?.status.conflicts[0]?.path;
    if (third) await h.services.resolveNestedConflict("Blogs", third, "delete");
    expect(h.store.getSnapshot().domains.get("Blogs")?.status.conflicts).toEqual([]);
    expect(h.vault.exists("Blogs/归档/目录.md")).toBe(false);
  });
});

describe("A8 — remove all", () => {
  it("strips markers, deletes confirmed index pages, clears confirmed orders, rest untouched", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    h.vault.seed("随笔/目录.md", indexPageContent("series"));
    h.vault.seed("随笔/01.md", note(10000, { tags: "keep" }));
    await h.services.scan();

    // pre-injection baseline: 随笔 was never confirmed for any step, so
    // after the wizard it must be byte-identical to this state
    const untouchedBefore = h.vault.readContent("随笔/01.md");

    h.settings.injectNavEnabled = true;
    await h.services.writeInjectionForAll();
    await h.services.rebuildIndex("Blogs");
    await h.services.rebuildIndex("随笔");

    await h.services.removeAllStep1Strip();
    await h.services.removeAllStep2DeleteIndexes(["Blogs"]);
    await h.services.removeAllStep3ClearOrders(["Blogs"]);

    expect(h.vault.exists("Blogs/目录.md")).toBe(false);
    expect(h.vault.exists("随笔/目录.md")).toBe(true);
    expect(orderOf(h, "Blogs/01 为什么选择 Quartz.md")).toBeUndefined();
    expect(orderOf(h, "随笔/01.md")).toBe(10000); // not confirmed → untouched
    for (const path of h.vault.listMarkdownFiles()) {
      expect(hasNavBlocks(h.vault.readContent(path)), path).toBe(false);
    }
    expect(h.vault.readContent("随笔/01.md")).toBe(untouchedBefore);
  });
});

describe("A10 — batch arrival", () => {
  it("20 creates in one window → batch pending, no per-file order writes", async () => {
    const h = makeHarness();
    h.vault.seed("读书/目录.md", indexPageContent("independent"));
    h.vault.seed("读书/01.md", note(10000));
    await h.services.scan();

    const paths: VaultPath[] = [];
    for (let i = 1; i <= 20; i++) {
      const path = `读书/new ${String(i).padStart(2, "0")}.md`;
      paths.push(path);
      h.vault.seed(path, "无 frontmatter\n");
    }
    await h.services.handleExternalBatch(paths.map((path) => ({ type: "create", path }) as const));

    for (const path of paths) {
      expect(orderOf(h, path), path).toBeUndefined();
    }
    const domain = h.store.getSnapshot().domains.get("读书");
    expect(domain?.status.pending.sort()).toEqual([...paths].sort());
  });

  it("a single create gets the tail order automatically", async () => {
    const h = makeHarness();
    h.vault.seed("读书/目录.md", indexPageContent("independent"));
    h.vault.seed("读书/01.md", note(10000));
    await h.services.scan();

    h.vault.seed("读书/新篇.md", "正文\n");
    await h.services.handleExternalBatch([{ type: "create", path: "读书/新篇.md" }]);
    expect(orderOf(h, "读书/新篇.md")).toBe(20000);
  });
});

describe("A11 — adopt an existing index file", () => {
  it("user keys and body stay byte-identical; plugin keys and block appended", async () => {
    const h = makeHarness();
    const original = "---\ntitle: 我的目录\naliases:\n  - MOC\n---\n用户序言。\n\n- 老列表\n";
    h.vault.seed("随笔/目录.md", original);
    h.vault.seed("随笔/01.md", note());
    h.vault.seed("随笔/02.md", note());

    await h.services.startManaging("随笔", "independent");

    const adopted = h.vault.readContent("随笔/目录.md");
    expect(adopted.startsWith("---\ntitle: 我的目录\naliases:\n  - MOC\n")).toBe(true);
    expect(adopted).toContain("is-index: true");
    expect(adopted).toContain("mode: independent");
    expect(adopted).toContain(INDEX_BLOCK_BEGIN);
    expect(adopted).toContain(INDEX_BLOCK_END);
    expect(adopted).toContain("用户序言。");
    expect(adopted).toContain("- 老列表");
    // first-run assignment gave orderless notes 10000-step values
    expect(orderOf(h, "随笔/01.md")).toBe(10000);
    expect(orderOf(h, "随笔/02.md")).toBe(20000);
  });
});

describe("startManaging — first run with pre-existing orders", () => {
  it("keeps existing values and flags the domain", async () => {
    const h = makeHarness();
    h.vault.seed("随笔/目录.md", "---\n---\n");
    h.vault.seed("随笔/a.md", note(7000));
    h.vault.seed("随笔/b.md", note());
    h.vault.seed("随笔/c.md", note());

    await h.services.startManaging("随笔", "series");

    expect(orderOf(h, "随笔/a.md")).toBe(7000); // untouched
    expect(orderOf(h, "随笔/b.md")).toBe(10000); // filename order fills the rest
    expect(orderOf(h, "随笔/c.md")).toBe(20000);
    expect(h.store.getSnapshot().domains.get("随笔")?.status.legacyHint).toBe(true);
  });
});

describe("legacy-order cleanup (vault banner → Review)", () => {
  it("clears leftover orders outside every domain after confirmation", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    h.vault.seed("旧项目/周刊/a.md", note(10000));
    h.vault.seed("旧项目/周刊/b.md", note(20000));
    await h.services.scan();

    const paths = h.store.getSnapshot().legacyOrders.get("旧项目/周刊") ?? [];
    expect(paths.length).toBe(2);

    await h.services.clearLegacyOrders(paths);
    expect(orderOf(h, "旧项目/周刊/a.md")).toBeUndefined();
    expect(orderOf(h, "旧项目/周刊/b.md")).toBeUndefined();
    // domain notes keep their orders; the banner is gone after rescan
    expect(orderOf(h, "Blogs/01 为什么选择 Quartz.md")).toBe(10000);
    expect(h.store.getSnapshot().legacyOrders.size).toBe(0);
  });
});

describe("auto-rebuild after order writes (PRD §2.5)", () => {
  it("a drag landing rebuilds the index automatically when enabled", async () => {
    const h = makeHarness({ autoRebuildIndex: true });
    seedSeriesVault(h);
    await h.services.scan();
    await h.services.rebuildIndex("Blogs");
    const before = h.vault.readContent("Blogs/目录.md");
    expect(before).toContain("[01 为什么选择 Quartz](01%20为什么选择%20Quartz.md)");

    // drag 01 below 02 — chain becomes 02,01,03,04,05
    await h.services.moveEntry("Blogs", "Blogs/01 为什么选择 Quartz.md", 1);

    const after = h.vault.readContent("Blogs/目录.md");
    expect(after).not.toBe(before);
    expect(after.indexOf("02 环境搭建与部署")).toBeLessThan(after.indexOf("01 为什么选择 Quartz"));
    expect(h.store.getSnapshot().domains.get("Blogs")?.status.stale).toBe(false);
  });

  it("with auto-rebuild off, the domain is flagged stale instead", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    await h.services.scan();
    await h.services.moveEntry("Blogs", "Blogs/01 为什么选择 Quartz.md", 1);
    expect(h.store.getSnapshot().domains.get("Blogs")?.status.stale).toBe(true);
  });
});

describe("dragging managed-folder entries (bugfix regression)", () => {
  it("writes the subfolder's order to its index page, not the folder", async () => {
    const h = makeHarness();
    h.vault.seed("读书/目录.md", indexPageContent("independent"));
    h.vault.seed("读书/01 引言.md", note(10000));
    h.vault.seed("读书/第一部分/目录.md", indexPageContent("independent", { order: 20000 }));
    h.vault.seed("读书/第一部分/a.md", note(10000));
    h.vault.seed("读书/03 文献.md", note(30000));
    await h.services.scan();

    // drag the managed subfolder to the head of the chain
    await h.services.moveEntry("读书", "读书/第一部分", 0);

    // the write landed on the subdomain's index page
    expect(orderOf(h, "读书/第一部分/目录.md")).toBe(5000);
    expect(h.notices.some((n) => n.includes("Entry moved") || n.includes("Gap too tight"))).toBe(
      true,
    );

    await h.services.scan();
    const domain = h.store.getSnapshot().domains.get("读书");
    expect(domain?.entries[0]?.title).toBe("第一部分");
  });

  it("reindexOrder also writes folder entries to their index pages", async () => {
    const h = makeHarness();
    h.vault.seed("读书/目录.md", indexPageContent("independent"));
    h.vault.seed("读书/01.md", note(7000));
    h.vault.seed("读书/第一部分/目录.md", indexPageContent("independent", { order: 12000 }));
    h.vault.seed("读书/第一部分/a.md", note(10000));
    await h.services.scan();

    await h.services.reindexOrder("读书");
    expect(orderOf(h, "读书/01.md")).toBe(10000);
    expect(orderOf(h, "读书/第一部分/目录.md")).toBe(20000);
    expect(h.notices.some((n) => n.includes("Write failed"))).toBe(false);
  });
});

describe("series guard (nested management not allowed)", () => {
  it("refuses to manage a folder inside a series domain and says why", async () => {
    const h = makeHarness();
    seedSeriesVault(h); // Blogs is a series domain with 进阶篇 inside
    await h.services.scan();

    const before = h.store.getSnapshot().domains.size;
    await h.services.startManaging("Blogs/进阶篇", "independent");

    expect(h.store.getSnapshot().domains.size).toBe(before);
    expect(h.vault.exists("Blogs/进阶篇/目录.md")).toBe(false);
    expect(h.notices.some((n) => n.includes("series domain"))).toBe(true);
  });

  it("still allows managing inside an independent domain", async () => {
    const h = makeHarness();
    h.vault.seed("读书/目录.md", indexPageContent("independent"));
    h.vault.seed("读书/01.md", note(10000));
    h.vault.seed("读书/第一部分/a.md", note());
    await h.services.scan();
    await h.services.startManaging("读书/第一部分", "series");
    expect(h.store.getSnapshot().domains.has("读书/第一部分")).toBe(true);
  });
});

describe("moveFolder — block move (folder drag)", () => {
  it("moves the whole subfolder as one block and normalizes orders", async () => {
    const h = makeHarness();
    h.vault.seed("Blogs/目录.md", indexPageContent("series"));
    h.vault.seed("Blogs/01.md", note(10000));
    h.vault.seed("Blogs/02.md", note(20000));
    h.vault.seed("Blogs/进阶篇/04.md", note(30000));
    h.vault.seed("Blogs/进阶篇/05.md", note(40000));
    h.vault.seed("Blogs/03.md", note(50000));
    await h.services.scan();

    // drag 进阶篇 above 01 → block [04,05] lands first
    await h.services.moveFolder("Blogs", "Blogs/进阶篇", {
      path: "Blogs/01.md",
      isFolder: false,
      edge: "top",
    });

    await h.services.scan();
    const domain = h.store.getSnapshot().domains.get("Blogs");
    expect(domain?.entries.map((entry) => entry.path)).toEqual([
      "Blogs/进阶篇/04.md",
      "Blogs/进阶篇/05.md",
      "Blogs/01.md",
      "Blogs/02.md",
      "Blogs/03.md",
    ]);
    // block move normalizes the whole domain
    expect(orderOf(h, "Blogs/进阶篇/04.md")).toBe(10000);
    expect(orderOf(h, "Blogs/进阶篇/05.md")).toBe(20000);
    expect(orderOf(h, "Blogs/01.md")).toBe(30000);
    expect(orderOf(h, "Blogs/02.md")).toBe(40000);
    expect(orderOf(h, "Blogs/03.md")).toBe(50000);
  });

  it("moving onto a later row keeps the block contiguous after the target", async () => {
    const h = makeHarness();
    h.vault.seed("Blogs/目录.md", indexPageContent("series"));
    h.vault.seed("Blogs/进阶篇/04.md", note(30000));
    h.vault.seed("Blogs/进阶篇/05.md", note(40000));
    h.vault.seed("Blogs/01.md", note(10000));
    h.vault.seed("Blogs/02.md", note(20000));
    await h.services.scan();

    // drop onto row 02 bottom → full-chain index 2, edge already applied
    await h.services.moveFolder("Blogs", "Blogs/进阶篇", {
      path: "Blogs/02.md",
      isFolder: false,
      edge: "bottom",
    });

    await h.services.scan();
    const domain = h.store.getSnapshot().domains.get("Blogs");
    expect(domain?.entries.map((entry) => entry.path)).toEqual([
      "Blogs/01.md",
      "Blogs/02.md",
      "Blogs/进阶篇/04.md",
      "Blogs/进阶篇/05.md",
    ]);
  });
});

describe("moveFileToFolder — drag a file out of a subfolder", () => {
  it("physically renames the file into the target folder", async () => {
    const h = makeHarness();
    h.vault.seed("Blogs/目录.md", indexPageContent("series"));
    h.vault.seed("Blogs/01.md", note(10000));
    h.vault.seed("Blogs/进阶篇/04.md", note(20000));
    h.vault.seed("Blogs/进阶篇/05.md", note(30000));
    await h.services.scan();

    await h.services.moveFileToFolder("Blogs", "Blogs/进阶篇/05.md", "Blogs");

    expect(h.vault.exists("Blogs/进阶篇/05.md")).toBe(false);
    expect(h.vault.exists("Blogs/05.md")).toBe(true);
    // the order field travels with the file — chain position preserved
    await h.services.scan();
    const domain = h.store.getSnapshot().domains.get("Blogs");
    expect(domain?.entries.map((entry) => entry.path)).toEqual([
      "Blogs/01.md",
      "Blogs/进阶篇/04.md",
      "Blogs/05.md",
    ]);
    expect(h.notices.some((n) => n.includes("✓ File moved to Blogs"))).toBe(true);
  });

  it("resolves basename collisions with a numeric suffix", async () => {
    const h = makeHarness();
    h.vault.seed("Blogs/目录.md", indexPageContent("series"));
    h.vault.seed("Blogs/笔记.md", note(10000));
    h.vault.seed("Blogs/进阶篇/笔记.md", note(20000));
    await h.services.scan();

    await h.services.moveFileToFolder("Blogs", "Blogs/进阶篇/笔记.md", "Blogs");

    expect(h.vault.exists("Blogs/笔记 1.md")).toBe(true);
    expect(h.vault.exists("Blogs/笔记.md")).toBe(true);
  });
});

describe("legacyHint — first-run review hint lifecycle", () => {
  it("appears on first run over existing orders and clears after reindex", async () => {
    const h = makeHarness();
    const { vault } = h;
    // two notes already carry orders (e.g. synced from another machine),
    // two have none — the mixed state the review hint exists for
    vault.seed("旧项目/a 已有.md", note(5000));
    vault.seed("旧项目/b 已有.md", note(6000));
    vault.seed("旧项目/c 无.md", note());
    vault.seed("旧项目/d 无.md", note());

    await h.services.startManaging("旧项目", "series");
    const status = () => h.store.getSnapshot().domains.get("旧项目")?.status;
    expect(status()?.legacyHint).toBe(true);
    // first-run assignment gave the orderless notes filename-order values
    // (10000 steps among themselves) and never touched existing orders
    expect(orderOf(h, "旧项目/c 无.md")).toBe(10000);
    expect(orderOf(h, "旧项目/d 无.md")).toBe(20000);
    expect(orderOf(h, "旧项目/a 已有.md")).toBe(5000);
    expect(orderOf(h, "旧项目/b 已有.md")).toBe(6000);

    // reindex = the user acted on the suggestion → the hint must go away
    await h.services.reindexOrder("旧项目");
    expect(status()?.legacyHint).toBe(false);

    // and it stays gone across rescans (the flag is sticky by carry-over)
    await h.services.scan();
    expect(status()?.legacyHint).toBe(false);
  });
});

describe("A5c — folder moves never wipe order (round 17)", () => {
  it("moving an ordered subfolder INTO a series domain keeps its orders", async () => {
    const h = makeHarness();
    const { vault } = h;
    vault.seed("A/目录.md", indexPageContent("series"));
    vault.seed("A/01.md", note(10000));
    vault.seed("C/c1.md", note(5000));
    vault.seed("C/c2.md", note(6000));
    await h.services.scan();

    // the user drags C into A in Obsidian's file explorer: folder rename
    // + one rename per child, all in one batch
    h.vault.moveFolder("C", "A/C");
    await h.services.handleExternalBatch([...h.vault.events]);

    // the carried orders slot the files into A's chain — nothing cleared
    expect(orderOf(h, "A/C/c1.md")).toBe(5000);
    expect(orderOf(h, "A/C/c2.md")).toBe(6000);
    const domain = h.store.getSnapshot().domains.get("A");
    expect(domain?.entries.map((entry) => entry.path)).toEqual([
      "A/C/c1.md",
      "A/C/c2.md",
      "A/01.md",
    ]);
    expect(domain?.status.pending).toEqual([]);
  });

  it("moving an ordered folder INTO an independent domain keeps the orders on disk", async () => {
    const h = makeHarness();
    const { vault } = h;
    vault.seed("A/目录.md", indexPageContent("independent"));
    vault.seed("A/01.md", note(10000));
    vault.seed("C/c1.md", note(5000));
    await h.services.scan();

    h.vault.moveFolder("C", "A/C");
    await h.services.handleExternalBatch([...h.vault.events]);

    // the independent chain only chains direct files + managed subfolders:
    // A/C stays unmanaged, but its carried orders are NOT wiped — they
    // come alive if the user later manages that folder
    expect(orderOf(h, "A/C/c1.md")).toBe(5000);
    const domain = h.store.getSnapshot().domains.get("A");
    expect(domain?.entries.map((entry) => entry.path)).toEqual(["A/01.md"]);
    expect(domain?.unmanagedFolders.map((f) => f.path)).toEqual(["A/C"]);
  });

  it("moving an ordered subfolder OUT of a domain keeps the orders as legacy values", async () => {
    const h = makeHarness();
    const { vault } = h;
    vault.seed("A/目录.md", indexPageContent("independent"));
    vault.seed("A/sub/x.md", note(10000));
    vault.seed("A/sub/y.md", note(20000));
    await h.services.scan();

    h.vault.seedFolder("备用区");
    h.vault.moveFolder("A/sub", "备用区/sub");
    await h.services.handleExternalBatch([...h.vault.events]);

    expect(orderOf(h, "备用区/sub/x.md")).toBe(10000);
    expect(orderOf(h, "备用区/sub/y.md")).toBe(20000);
    // nothing silently destroyed: the leftovers surface in the banner
    expect([...h.store.getSnapshot().legacyOrders.keys()]).toContain("备用区/sub");
  });

  it("split batches still keep orders (the old parent folder is gone)", async () => {
    const h = makeHarness();
    const { vault } = h;
    vault.seed("A/目录.md", indexPageContent("independent"));
    vault.seed("C/c1.md", note(5000));
    await h.services.scan();

    h.vault.moveFolder("C", "A/C");
    // batch 1: only the folder's own rename arrives
    const folderEvent = h.vault.events.find((e) => e.oldPath === "C");
    await h.services.handleExternalBatch(folderEvent ? [folderEvent] : []);
    // batch 2: the child file renames
    const fileEvents = h.vault.events.filter((e) => e.oldPath?.startsWith("C/"));
    await h.services.handleExternalBatch(fileEvents);

    expect(orderOf(h, "A/C/c1.md")).toBe(5000);
  });

  it("a single file moved out of a domain is still cleared (designed behavior)", async () => {
    const h = makeHarness();
    const { vault } = h;
    vault.seed("A/目录.md", indexPageContent("independent"));
    vault.seed("A/01.md", note(10000));
    await h.services.scan();

    await vault.rename("A/01.md", "草稿/01.md");
    await h.services.handleExternalBatch([
      { type: "rename", path: "草稿/01.md", oldPath: "A/01.md" },
    ]);
    expect(orderOf(h, "草稿/01.md")).toBeUndefined();
  });
});

describe("dissolve behavior — deleteIndexOnDissolve (round 17)", () => {
  it("default: the index page is trashed (original behavior)", async () => {
    const h = makeHarness();
    seedSeriesVault(h);
    await h.services.scan();
    await h.services.stopManaging("Blogs", { clearOrder: false, stripNav: false });
    expect(h.vault.exists("Blogs/目录.md")).toBe(false);
    expect(h.store.getSnapshot().domains.has("Blogs")).toBe(false);
  });

  it("with the setting off the page stays as a normal note, markers removed", async () => {
    const h = makeHarness({ deleteIndexOnDissolve: false });
    seedSeriesVault(h);
    await h.services.scan();
    await h.services.stopManaging("Blogs", { clearOrder: false, stripNav: false });

    expect(h.vault.exists("Blogs/目录.md")).toBe(true);
    const page = h.vault.readContent("Blogs/目录.md");
    expect(page).not.toContain("chapter-trail:begin");
    expect(page).not.toContain("is-index");
    expect(page).not.toContain("mode: series");
    // the note itself and the orders are untouched
    expect(orderOf(h, "Blogs/01 为什么选择 Quartz.md")).toBe(10000);
    expect(h.store.getSnapshot().domains.has("Blogs")).toBe(false);
  });
});

describe("round 20 — listFolderTree (tree folder picker)", () => {
  it("builds a pruned multi-root tree with candidates, managed and series hints", async () => {
    const h = makeHarness();
    const { vault } = h;
    vault.seed("Blogs/目录.md", indexPageContent("series"));
    vault.seed("Blogs/01.md", note(10000));
    vault.seed("Blogs/进阶篇/02.md", note(20000));
    vault.seed("读书/目录.md", indexPageContent("independent"));
    vault.seed("读书/引言.md", note(10000));
    vault.seed("随笔/如何写作.md", note());
    vault.seed("随笔/深处/只有空文件夹的目录.md", indexPageContent("series")); // nested series
    await h.services.scan();

    const tree = h.services.listFolderTree();
    const roots = tree.map((node) => node.name).sort();
    expect(roots).toEqual(["Blogs", "读书", "随笔"]);

    const blogs = tree.find((node) => node.path === "Blogs");
    expect(blogs?.managed).toBe(true);
    expect(blogs?.selectable).toBe(false);
    expect(blogs?.children.map((child) => child.name)).toEqual(["进阶篇"]);
    expect(blogs?.children[0]?.hint).toBe("inside a series domain");
    expect(blogs?.children[0]?.selectable).toBe(false);

    const suibi = tree.find((node) => node.path === "随笔");
    expect(suibi?.selectable).toBe(true);
    expect(suibi?.notes).toBe(1);
    expect(suibi?.children.map((child) => child.name)).toEqual(["深处"]);
    expect(suibi?.children[0]?.children).toEqual([]); // leaf, no pruning below

    // truly empty branches are pruned: no folder without notes/subfolders
    for (const node of tree) {
      const walk = (n: {
        path: string;
        notes: number;
        subfolders: number;
        children: unknown[];
      }) => {
        if (n.notes === 0 && n.subfolders === 0 && n.children.length === 0) {
          throw new Error(`empty branch survived: ${n.path}`);
        }
        for (const child of n.children as never[]) walk(child as never);
      };
      walk(node);
    }
  });
});

describe("round 21 — picker exclusions", () => {
  it("hides asset folders (any depth, case-insensitive) from the tree", async () => {
    const h = makeHarness();
    const { vault } = h;
    vault.seed("随笔/01.md", note(10000));
    vault.seed("随笔/assets/图片.png.md", note(20000));
    vault.seed("Quartz/assets/图.md", note(30000));
    vault.seed("Attachments/a.md", note(40000));
    await h.services.scan();

    const paths: string[] = [];
    const walk = (nodes: ReturnType<typeof h.services.listFolderTree>): void => {
      for (const node of nodes) {
        paths.push(node.path);
        walk(node.children);
      }
    };
    walk(h.services.listFolderTree());

    expect(paths).toContain("随笔");
    expect(paths).not.toContain("随笔/assets");
    expect(paths).not.toContain("Quartz/assets");
    expect(paths).not.toContain("Attachments"); // case-insensitive match
  });
});
