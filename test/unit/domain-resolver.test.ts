import { describe, expect, it } from "vitest";
import { INDEX_BLOCK_BEGIN, INDEX_BLOCK_END } from "../../src/constants";
import { buildRegistry, type VaultSnapshot } from "../../src/core/domain-resolver";

interface NoteSpec {
  frontmatter?: Record<string, unknown>;
  body?: string;
}

function makeSnapshot(notes: Record<string, NoteSpec>): VaultSnapshot {
  return {
    files: Object.entries(notes).map(([path, spec]) => ({
      path,
      frontmatter: spec.frontmatter ?? null,
    })),
    readFileBody: (path: string) => {
      const spec = notes[path];
      if (!spec) throw new Error(`no such note: ${path}`);
      return Promise.resolve(spec.body ?? "");
    },
  };
}

function indexPage(
  mode: "series" | "independent",
  extra?: Record<string, unknown>,
  inner = "",
): NoteSpec {
  return {
    frontmatter: { "is-index": true, mode, ...extra },
    body: `${INDEX_BLOCK_BEGIN}\n${inner}\n${INDEX_BLOCK_END}\n`,
  };
}

describe("buildRegistry — domain detection", () => {
  it("marked means managed: is-index + marker block", async () => {
    const snap = makeSnapshot({
      "Blogs/目录.md": indexPage("series"),
      "Blogs/01.md": { frontmatter: { order: 10000 } },
    });
    const registry = await buildRegistry(snap);
    expect(registry.domains.size).toBe(1);
    expect(registry.domains.get("Blogs")?.mode).toBe("series");
  });

  it("is-index without a marker block is an ordinary note", async () => {
    const snap = makeSnapshot({
      "Blogs/目录.md": { frontmatter: { "is-index": true }, body: "no markers here" },
      "Blogs/01.md": { frontmatter: { order: 10000 } },
    });
    const registry = await buildRegistry(snap);
    expect(registry.domains.size).toBe(0);
    expect(registry.orphans).toEqual([]);
  });

  it("a vault-root index page is an orphan, never a domain", async () => {
    const snap = makeSnapshot({ "目录.md": indexPage("series") });
    const registry = await buildRegistry(snap);
    expect(registry.domains.size).toBe(0);
    expect(registry.orphans).toEqual(["目录.md"]);
  });

  it("duplicate index pages leave the folder unmanaged", async () => {
    const snap = makeSnapshot({
      "A/目录.md": indexPage("series"),
      "A/index.md": indexPage("independent"),
    });
    const registry = await buildRegistry(snap);
    expect(registry.domains.size).toBe(0);
    expect(new Set(registry.orphans)).toEqual(new Set(["A/目录.md", "A/index.md"]));
  });
});

describe("buildRegistry — series chains (A2)", () => {
  it("recurses the whole subtree with path prefixes, index page excluded", async () => {
    const snap = makeSnapshot({
      "Blogs/目录.md": indexPage("series"),
      "Blogs/01 为什么选择 Quartz.md": { frontmatter: { order: 10000, created: "2025-11-02" } },
      "Blogs/02 环境搭建与部署.md": { frontmatter: { order: 20000, created: "2025-11-09" } },
      "Blogs/进阶篇/03 配置详解.md": { frontmatter: { order: 30000 } },
      "Blogs/进阶篇/04 插件机制.md": { frontmatter: { order: 40000 } },
    });
    const registry = await buildRegistry(snap);
    const domain = registry.domains.get("Blogs");
    expect(domain?.entries.map((e) => [e.path, e.prefix])).toEqual([
      ["Blogs/01 为什么选择 Quartz.md", undefined],
      ["Blogs/02 环境搭建与部署.md", undefined],
      ["Blogs/进阶篇/03 配置详解.md", "进阶篇/"],
      ["Blogs/进阶篇/04 插件机制.md", "进阶篇/"],
    ]);
    expect(domain?.entries[0]?.dates?.created).toBe("2025-11-02");
  });

  it("respects file-level and folder-level exclusions", async () => {
    const snap = makeSnapshot({
      "Blogs/目录.md": indexPage("series", { "excluded-folders": ["drafts"] }),
      "Blogs/01.md": { frontmatter: { order: 10000 } },
      "Blogs/02.md": { frontmatter: { order: 20000, excluded: true } },
      "Blogs/drafts/03.md": { frontmatter: { order: 30000 } },
    });
    const registry = await buildRegistry(snap);
    const domain = registry.domains.get("Blogs");
    expect(domain?.entries.map((e) => e.path)).toEqual(["Blogs/01.md"]);
    expect(domain?.excludedFolders).toEqual(["drafts"]);
  });

  it("flags a nested index page as a conflict unless the subtree is excluded", async () => {
    const snap = makeSnapshot({
      "Blogs/目录.md": indexPage("series", { "excluded-folders": ["旧稿"] }),
      "Blogs/进阶篇/目录.md": indexPage("series"),
      "Blogs/旧稿/目录.md": indexPage("series"),
      "Blogs/01.md": { frontmatter: { order: 10000 } },
    });
    const registry = await buildRegistry(snap);
    const blogs = registry.domains.get("Blogs");
    expect(blogs?.status.conflicts).toEqual([
      { kind: "nested-index", path: "Blogs/进阶篇/目录.md" },
    ]);
  });

  it("reports pending, ties and tight gaps", async () => {
    const snap = makeSnapshot({
      "随笔/目录.md": indexPage("series"),
      "随笔/01.md": { frontmatter: { order: 10000 } },
      "随笔/02.md": { frontmatter: { order: 10003 } },
      "随笔/03.md": { frontmatter: { order: 20000 } },
      "随笔/04.md": { frontmatter: { order: 20000 } },
      "随笔/new.md": {},
    });
    const registry = await buildRegistry(snap);
    const domain = registry.domains.get("随笔");
    expect(domain?.status.pending).toEqual(["随笔/new.md"]);
    expect(new Set(domain?.status.ties ?? [])).toEqual(new Set(["随笔/03.md", "随笔/04.md"]));
    expect(domain?.status.tightGap).toBe(true);
  });
});

describe("buildRegistry — independent mixing (A1)", () => {
  it("mixes direct files with managed subfolders by order", async () => {
    const snap = makeSnapshot({
      "读书/目录.md": indexPage("independent"),
      "读书/01 引言.md": { frontmatter: { order: 10000, created: "2025-09-14" } },
      "读书/第一部分/目录.md": indexPage("independent", { order: 20000 }),
      "读书/第一部分/01.md": { frontmatter: { order: 10000 } },
      "读书/03 文献笔记.md": { frontmatter: { order: 30000 } },
    });
    const registry = await buildRegistry(snap);
    const domain = registry.domains.get("读书");
    expect(domain?.entries.map((e) => [e.path, e.kind])).toEqual([
      ["读书/01 引言.md", "file"],
      ["读书/第一部分", "managed-folder"],
      ["读书/03 文献笔记.md", "file"],
    ]);
    // the subfolder keeps its own domain and chain
    expect(registry.domains.get("读书/第一部分")?.entries.map((e) => e.path)).toEqual([
      "读书/第一部分/01.md",
    ]);
    // unmanaged list is empty here (no other folders)
    expect(domain?.unmanagedFolders).toEqual([]);
  });

  it("lists unmanaged non-empty subfolders as plain text; empty and excluded omitted", async () => {
    const snap = makeSnapshot({
      "读书/目录.md": indexPage("independent", { "excluded-folders": ["私有"] }),
      "读书/01.md": { frontmatter: { order: 10000 } },
      "读书/参考资料/note.md": {},
      "读书/私有/secret.md": {},
      "读书/空文件夹/什么都没有.txt": { body: "not a note" },
    });
    const registry = await buildRegistry(snap);
    const domain = registry.domains.get("读书");
    expect(domain?.unmanagedFolders.map((f) => f.title)).toEqual(["参考资料"]);
  });
});

describe("buildRegistry — broken links (A4 groundwork)", () => {
  it("flags index links whose target is missing", async () => {
    const inner = "- [01](./01.md)\n- [gone](./deleted.md)";
    const snap = makeSnapshot({
      "Blogs/目录.md": indexPage("series", undefined, inner),
      "Blogs/01.md": { frontmatter: { order: 10000 } },
    });
    const registry = await buildRegistry(snap);
    expect(registry.domains.get("Blogs")?.status.broken).toEqual(["Blogs/deleted.md"]);
  });
});

describe("buildRegistry — legacy orders (vault banner)", () => {
  it("groups order-bearing files outside domains by folder", async () => {
    const snap = makeSnapshot({
      "Blogs/目录.md": indexPage("series"),
      "Blogs/01.md": { frontmatter: { order: 10000 } },
      "旧项目/周刊/a.md": { frontmatter: { order: 10000 } },
      "旧项目/周刊/b.md": { frontmatter: { order: 20000 } },
      "孤儿.md": { frontmatter: { order: 10000 } },
    });
    const registry = await buildRegistry(snap);
    expect(registry.legacyOrders.get("旧项目/周刊")?.sort()).toEqual([
      "旧项目/周刊/a.md",
      "旧项目/周刊/b.md",
    ]);
    expect(registry.legacyOrders.has("")).toBe(false);
  });
});

describe("buildRegistry — dates", () => {
  it("whitelist parses created/updated; failures show no date", async () => {
    const snap = makeSnapshot({
      "Blogs/目录.md": indexPage("series"),
      "Blogs/01.md": { frontmatter: { order: 10000, created: "2025-11-09T10:30" } },
      "Blogs/02.md": { frontmatter: { order: 20000, created: "明天" } },
      "Blogs/03.md": { frontmatter: { order: 30000, updated: "2026-01-12" } },
    });
    const registry = await buildRegistry(snap);
    const entries = registry.domains.get("Blogs")?.entries ?? [];
    expect(entries[0]?.dates).toEqual({ created: "2025-11-09" });
    expect(entries[1]?.dates).toBeUndefined();
    expect(entries[2]?.dates).toEqual({ updated: "2026-01-12" });
  });
});
