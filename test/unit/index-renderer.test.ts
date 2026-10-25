import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../../src/core/domain-resolver";
import { renderIndexInner } from "../../src/core/index-renderer";
import { indexPageSpec, makeSnapshot } from "../helpers";

const goldenDir = fileURLToPath(new URL("../golden", import.meta.url));

function golden(name: string): string {
  return readFileSync(join(goldenDir, name), "utf8");
}

describe("renderIndexInner — golden files", () => {
  it("series domain renders the indented tree with plain-text folders", async () => {
    const registry = await buildRegistry(
      makeSnapshot({
        "Blogs/目录.md": indexPageSpec("series"),
        "Blogs/01 为什么选择 Quartz.md": {
          frontmatter: { order: 10000, created: "2025-11-02" },
        },
        "Blogs/02 环境搭建与部署.md": {
          frontmatter: { order: 20000, created: "2025-11-09" },
        },
        "Blogs/进阶篇/03 配置详解.md": {
          frontmatter: { order: 30000, created: "2025-11-16" },
        },
        "Blogs/进阶篇/04 插件机制.md": {
          frontmatter: { order: 40000, created: "2025-11-23" },
        },
        "Blogs/进阶篇/05 主题定制.md": {
          frontmatter: { order: 50000, created: "2025-11-30" },
        },
      }),
    );
    const domain = registry.domains.get("Blogs");
    expect(domain).toBeDefined();
    const output = renderIndexInner(domain!, registry, { dateDisplay: "created" });
    expect(output).toBe(golden("series-index.md"));
  });

  it("independent domain mixes files and managed folders, unmanaged trail", async () => {
    const registry = await buildRegistry(
      makeSnapshot({
        "读书/目录.md": indexPageSpec("independent"),
        "读书/引言：卢曼的盒子.md": {
          frontmatter: { order: 10000, created: "2025-09-14" },
        },
        "读书/第一部分 · 原理/目录.md": indexPageSpec("independent", { order: 20000 }),
        "读书/第一部分 · 原理/01.md": { frontmatter: { order: 10000 } },
        "读书/卡片的三种类型.md": {
          frontmatter: { order: 30000, created: "2025-09-28" },
        },
        "读书/文献笔记与永久笔记.md": {
          frontmatter: { order: 40000, created: "2025-10-05" },
        },
        "读书/参考资料/note.md": {},
      }),
    );
    const domain = registry.domains.get("读书");
    expect(domain).toBeDefined();
    const output = renderIndexInner(domain!, registry, { dateDisplay: "created" });
    expect(output).toBe(golden("independent-index.md"));
  });
});

describe("renderIndexInner — date display variants", () => {
  it("updated mode and both mode", async () => {
    const registry = await buildRegistry(
      makeSnapshot({
        "随笔/目录.md": indexPageSpec("series"),
        "随笔/01.md": {
          frontmatter: { order: 10000, created: "2025-11-09", updated: "2026-01-12" },
        },
      }),
    );
    const domain = registry.domains.get("随笔")!;
    expect(renderIndexInner(domain, registry, { dateDisplay: "updated" })).toBe(
      "- [01](./01.md) 2026-01-12\n",
    );
    expect(renderIndexInner(domain, registry, { dateDisplay: "both" })).toBe(
      "- [01](./01.md) 2025-11-09 → 2026-01-12\n",
    );
  });

  it("entries without a parsable date show none", async () => {
    const registry = await buildRegistry(
      makeSnapshot({
        "随笔/目录.md": indexPageSpec("series"),
        "随笔/01.md": { frontmatter: { order: 10000, created: "不知何时" } },
      }),
    );
    const domain = registry.domains.get("随笔")!;
    expect(renderIndexInner(domain, registry, { dateDisplay: "created" })).toBe(
      "- [01](./01.md)\n",
    );
  });
});
