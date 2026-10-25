import { describe, expect, it } from "vitest";
import {
  INDEX_BLOCK_BEGIN,
  INDEX_BLOCK_END,
  NAV_BLOCK_BEGIN,
  NAV_BLOCK_END,
} from "../../src/constants";
import {
  findIndexBlock,
  findNavBlocks,
  hasIndexBlock,
  hasNavBlocks,
  navBlockText,
  stripNavBlocks,
  writeIndexBlock,
  writeNavBlocks,
} from "../../src/core/block-codec";

describe("index block", () => {
  const page = `---\nmode: series\n---\n<!-- chapter-trail:begin -->\n- [a](./a.md)\n- [b](./b.md)\n<!-- chapter-trail:end -->\n\n正文。\n`;

  it("finds the block and its inner content", () => {
    const block = findIndexBlock(page);
    expect(block).not.toBeNull();
    expect(block?.inner).toBe("- [a](./a.md)\n- [b](./b.md)\n");
    expect(block?.damaged).toBe(false);
  });

  it("replaces inner content, keeping everything else byte-identical", () => {
    const next = writeIndexBlock(page, "- [c](./c.md)\n- [d](./d.md)");
    expect(next).toBe(
      `---\nmode: series\n---\n<!-- chapter-trail:begin -->\n- [c](./c.md)\n- [d](./d.md)\n<!-- chapter-trail:end -->\n\n正文。\n`,
    );
  });

  it("inserts a fresh block right after the frontmatter", () => {
    const raw = `---\ntitle: t\n---\n用户序言。\n\n- 老列表\n`;
    const next = writeIndexBlock(raw, "- [a](./a.md)");
    expect(next).toBe(
      `---\ntitle: t\n---\n<!-- chapter-trail:begin -->\n- [a](./a.md)\n<!-- chapter-trail:end -->\n用户序言。\n\n- 老列表\n`,
    );
  });

  it("inserts at file start when there is no frontmatter", () => {
    const next = writeIndexBlock("正文\n", "- [a](./a.md)");
    expect(next.startsWith(`${INDEX_BLOCK_BEGIN}\n- [a](./a.md)\n${INDEX_BLOCK_END}\n`)).toBe(true);
  });

  it("repairs a damaged block (begin without end)", () => {
    const damaged = `---\n---\n${INDEX_BLOCK_BEGIN}\n- stale\n- lines\n正文\n`;
    const next = writeIndexBlock(damaged, "- [a](./a.md)");
    // per DESIGN 4.5 a dangling begin owns everything up to the next
    // begin or EOF — the repair replaces that whole range
    expect(next).toBe(`---\n---\n${INDEX_BLOCK_BEGIN}\n- [a](./a.md)\n${INDEX_BLOCK_END}\n`);
  });

  it("does not match markers mentioned mid-sentence", () => {
    const text = `正文提到 ${INDEX_BLOCK_BEGIN} 只是一段文字。\n`;
    expect(hasIndexBlock(text)).toBe(false);
  });

  it("preserves CRLF", () => {
    const raw = `---\r\nmode: series\r\n---\r\n${INDEX_BLOCK_BEGIN}\r\n- old\r\n${INDEX_BLOCK_END}\r\nbody\r\n`;
    const next = writeIndexBlock(raw, "- new");
    expect(next).toBe(
      `---\r\nmode: series\r\n---\r\n${INDEX_BLOCK_BEGIN}\r\n- new\r\n${INDEX_BLOCK_END}\r\nbody\r\n`,
    );
  });
});

describe("nav wrappers", () => {
  const callout =
    "> [!chapter-trail]- 上一篇：[a](./a.md) | 总览：[目录](./目录.md) | 下一篇：[b](./b.md)";

  it("writes top block after frontmatter and bottom block at EOF", () => {
    const raw = `---\norder: 10000\n---\n正文段落。\n`;
    const next = writeNavBlocks(raw, callout);
    expect(next).toBe(
      `---\norder: 10000\n---\n${NAV_BLOCK_BEGIN}\n${callout}\n${NAV_BLOCK_END}\n正文段落。\n${NAV_BLOCK_BEGIN}\n${callout}\n${NAV_BLOCK_END}\n`,
    );
    expect(findNavBlocks(next).length).toBe(2);
  });

  it("writes one block for an empty-bodied note", () => {
    const raw = "---\norder: 10000\n---\n";
    const next = writeNavBlocks(raw, callout);
    expect(findNavBlocks(next).length).toBe(1);
  });

  it("strip removes both blocks with zero residue", () => {
    const injected = writeNavBlocks("---\norder: 10000\n---\n正文段落。\n", callout);
    const { text, removed } = stripNavBlocks(injected);
    expect(removed).toBe(true);
    expect(text).toBe("---\norder: 10000\n---\n正文段落。\n");
  });

  it("strip keeps user-written callouts", () => {
    const raw = `${NAV_BLOCK_BEGIN}\n${callout}\n${NAV_BLOCK_END}\n> [!note]- 我自己写的\n内容\n`;
    const { text } = stripNavBlocks(raw);
    expect(text).toBe("> [!note]- 我自己写的\n内容\n");
  });

  it("hasNavBlocks detects wrappers", () => {
    expect(hasNavBlocks(navBlockText(callout))).toBe(true);
    expect(hasNavBlocks("plain note\n")).toBe(false);
  });

  it("rebuild replaces old wrappers with the new chain", () => {
    const first = writeNavBlocks("---\n---\nbody\n", callout);
    const secondCallout = callout.replace("[b](./b.md)", "[c](./c.md)");
    const second = writeNavBlocks(first, secondCallout);
    expect(second).not.toContain("[b](./b.md)");
    expect(findNavBlocks(second).length).toBe(2);
    expect(second).toBe(writeNavBlocks("---\n---\nbody\n", secondCallout));
  });
});

describe("frontmatterText helper", () => {
  it("extracts the YAML between the fences", async () => {
    const { frontmatterText } = await import("../../src/core/text-util");
    expect(frontmatterText("---\norder: 10000\ntitle: t\n---\nbody\n")).toBe(
      "order: 10000\ntitle: t",
    );
    expect(frontmatterText("---\r\norder: 1\r\n---\r\nbody\r\n")).toBe("order: 1");
    expect(frontmatterText("no frontmatter\n")).toBeNull();
    expect(frontmatterText("---\n---\nbody\n")).toBe("");
  });
});
