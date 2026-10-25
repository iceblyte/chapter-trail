/**
 * A9 performance benchmarks (DESIGN.md §2.1 ①, targets: 10k-note scan
 * < 2s; 500-entry domain drag plan < 100ms; full reindex plan < 5s).
 * Run with: pnpm bench
 */
import { bench, describe } from "vitest";
import { FakeVault } from "../../src/adapter/fake-vault";
import { buildRegistry } from "../../src/core/domain-resolver";
import { normalizedOrder, planInsert } from "../../src/core/sort-core";
import type { OrderEntry, VaultPath } from "../../src/types";

function seedVault(domainCount: number, notesPerDomain: number): FakeVault {
  const vault = new FakeVault();
  for (let d = 0; d < domainCount; d++) {
    const root = `domain-${d}`;
    vault.seed(
      `${root}/目录.md`,
      `---\nis-index: true\nmode: ${d % 2 === 0 ? "series" : "independent"}\n---\n<!-- chapter-trail:begin -->\n<!-- chapter-trail:end -->\n`,
    );
    for (let i = 0; i < notesPerDomain; i++) {
      const deep = d % 2 === 0 && i % 3 === 0 ? "进阶篇" : "";
      const folder = deep ? `${root}/${deep}` : root;
      vault.seed(
        `${folder}/note-${String(i).padStart(4, "0")}.md`,
        `---\ncreated: 2025-01-01\norder: ${(i + 1) * 10000}\n---\n正文\n`,
      );
    }
  }
  return vault;
}

function snapshotOf(vault: FakeVault) {
  return {
    files: vault.listMarkdownFiles().map((path) => ({
      path: path as VaultPath,
      frontmatter: vault.getFrontmatter(path) ?? null,
    })),
    readFileBody: (path: string) => vault.read(path),
  };
}

describe("A9 startup scan", () => {
  const vault = seedVault(20, 500); // 10k notes
  bench("buildRegistry over 10,000 notes / 20 domains", async () => {
    await buildRegistry(snapshotOf(vault));
  });
});

describe("A9 drag plan", () => {
  const chain: OrderEntry[] = Array.from({ length: 500 }, (_, i) => ({
    path: `d/note-${i}.md`,
    kind: "file" as const,
    title: `note-${i}`,
    order: normalizedOrder(i),
  }));
  bench("planInsert on a 500-entry domain", () => {
    planInsert(chain, "d/note-499.md", 3);
  });
});
