import { describe, expect, it } from "vitest";
import { hasNavBlocks } from "../../src/core/block-codec";
import { calloutLine, calloutLines } from "../../src/core/nav-template";
import { buildInjectionPlan, buildStripPlan, InjectionSession } from "../../src/core/nav-writer";
import type { OrderEntry } from "../../src/types";

function entry(path: string, order: number): OrderEntry {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return { path, kind: "file", title: base.replace(/\.md$/, ""), order };
}

const CHAIN = [
  entry("Blogs/01 为什么选择 Quartz.md", 10000),
  entry("Blogs/02 环境搭建与部署.md", 20000),
  entry("Blogs/进阶篇/03 配置详解.md", 30000),
  entry("Blogs/进阶篇/04 插件机制.md", 40000),
  entry("Blogs/进阶篇/05 主题定制.md", 50000),
];

describe("calloutLine matrix (PRD 2.6)", () => {
  const ctx = { indexPath: "Blogs/目录.md" };

  it("middle entry carries all three slots with ../ links for subfolders", () => {
    expect(calloutLine(CHAIN, 2, ctx)).toBe(
      "> [!chapter-trail]- 上一篇：[02 环境搭建与部署](../02 环境搭建与部署.md) | 总览：[目录](../目录.md) | 下一篇：[04 插件机制](./04 插件机制.md)",
    );
  });

  it("first entry omits 上一篇", () => {
    const line = calloutLine(CHAIN, 0, ctx);
    expect(line).toBe(
      "> [!chapter-trail]- 总览：[目录](./目录.md) | 下一篇：[02 环境搭建与部署](./02 环境搭建与部署.md)",
    );
  });

  it("last entry omits 下一篇", () => {
    const line = calloutLine(CHAIN, 4, ctx);
    expect(line).toBe(
      "> [!chapter-trail]- 上一篇：[04 插件机制](./04 插件机制.md) | 总览：[目录](../目录.md)",
    );
  });

  it("single-entry chain keeps only 总览", () => {
    const line = calloutLine([entry("A/独.md", 10000)], 0, { indexPath: "A/目录.md" });
    expect(line).toBe("> [!chapter-trail]- 总览：[目录](./目录.md)");
  });

  it("covers every chain file exactly once", () => {
    const lines = calloutLines(CHAIN, ctx);
    expect(lines.size).toBe(5);
    expect(lines.has("Blogs/02 环境搭建与部署.md")).toBe(true);
  });
});

describe("InjectionGate — the hard invariant (A3)", () => {
  it("a closed setting cannot mint a gate", () => {
    expect(InjectionSession.open(false)).toBeNull();
  });

  it("an open setting mints exactly one kind of gate", () => {
    const gate = InjectionSession.open(true);
    expect(gate).not.toBeNull();
  });
});

describe("buildInjectionPlan", () => {
  const ctx = { indexPath: "Blogs/目录.md" };
  const gate = InjectionSession.open(true)!;

  it("writes wrappers for chain members and strips others in scope", () => {
    const plan = buildInjectionPlan(
      gate,
      CHAIN,
      ["Blogs/02 环境搭建与部署.md", "Blogs/drafts/旧稿.md"],
      ctx,
    );
    expect(plan.ops.length).toBe(2);

    const injected = plan.ops[0]!.apply("---\norder: 20000\n---\n正文\n");
    expect(hasNavBlocks(injected)).toBe(true);
    expect(injected).toContain("上一篇：[01 为什么选择 Quartz](./01 为什么选择 Quartz.md)");
    expect(injected).toContain("下一篇：[03 配置详解](./进阶篇/03 配置详解.md)");

    const stale =
      "<!-- chapter-trail:nav-begin -->\n> [!chapter-trail]- 旧的\n<!-- chapter-trail:nav-end -->\n正文\n";
    const stripped = plan.ops[1]!.apply(stale);
    expect(hasNavBlocks(stripped)).toBe(false);
  });

  it("re-running a plan on already-injected text is a no-op", () => {
    const plan = buildInjectionPlan(gate, CHAIN, ["Blogs/02 环境搭建与部署.md"], ctx);
    const once = plan.ops[0]!.apply("---\norder: 20000\n---\n正文\n");
    expect(plan.ops[0]!.apply(once)).toBe(once);
  });
});

describe("buildStripPlan", () => {
  it("returns raw text for files without markers (writer skips them)", () => {
    const gate = InjectionSession.open(true)!;
    const plan = buildStripPlan(gate, ["plain.md"]);
    const raw = "没有任何标记的笔记\n";
    expect(plan.ops[0]!.apply(raw)).toBe(raw);
  });
});
