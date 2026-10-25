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
    expect(index).toBe(
      [
        "---",
        "is-index: true",
        "mode: independent",
        "---",
        "",
        INDEX_BLOCK_BEGIN,
        "- [引言：卢曼的盒子](./引言：卢曼的盒子.md) 2025-09-14",
        "- [第一部分](./第一部分/目录.md)",
        "- [卡片的三种类型](./卡片的三种类型.md) 2025-09-28",
        "- 参考资料",
        INDEX_BLOCK_END,
        "",
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
      "> [!chapter-trail]- 总览：[目录](./目录.md) | 下一篇：[02 环境搭建与部署](./02 环境搭建与部署.md)",
    );
    expect(first).not.toContain("上一篇：");

    const middle = h.vault.readContent("Blogs/进阶篇/03 配置详解.md");
    expect(middle).toContain("上一篇：[02 环境搭建与部署](../02 环境搭建与部署.md)");
    expect(middle).toContain("总览：[目录](../目录.md)");
    expect(middle).toContain("下一篇：[04 插件机制](./04 插件机制.md)");

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
      "[04 插件机制](./进阶篇/04 插件机制.md)",
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
    expect(neighbor).toContain("下一篇：[05 主题定制](./05 主题定制.md)");
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
    expect(before).toContain("[01 为什么选择 Quartz](./01 为什么选择 Quartz.md)");

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
