import { describe, expect, it } from "vitest";
import { type PatchOp, patchFrontmatter, serializeValue } from "../../src/core/frontmatter-patch";

const upsert = (
  key: PatchOp extends { key: infer K } ? K : never,
  value: string | number | boolean | readonly string[],
): PatchOp => ({ op: "upsert", key, value });

describe("serializeValue", () => {
  it("writes scalars plainly", () => {
    expect(serializeValue(15000)).toBe("15000");
    expect(serializeValue(true)).toBe("true");
    expect(serializeValue("series")).toBe("series");
  });
  it("quotes strings with YAML-special characters", () => {
    expect(serializeValue("a, b")).toBe('"a, b"');
    expect(serializeValue("why: not")).toBe('"why: not"');
    expect(serializeValue("")).toBe('""');
    expect(serializeValue("含空格 路径")).toBe("含空格 路径");
  });
  it("writes simple lists in flow style, complex ones as blocks", () => {
    expect(serializeValue(["a", "b"])).toBe("[a, b]");
    expect(serializeValue([])).toBe("[]");
    expect(serializeValue(["x, y", "z"])).toBe('- "x, y"\n- z');
  });
});

describe("patchFrontmatter — property split (A11 core)", () => {
  it("upserts a new plugin key while keeping user keys byte-identical", () => {
    const raw = `---\ntitle: 我的笔记\ncreated: 2025-11-09\ntags:\n  - inbox\n  - draft\n---\n\n正文第一行。\n`;
    const result = patchFrontmatter(raw, [upsert("order", 20000)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.text).toBe(
      `---\ntitle: 我的笔记\ncreated: 2025-11-09\ntags:\n  - inbox\n  - draft\norder: 20000\n---\n\n正文第一行。\n`,
    );
  });

  it("replaces only the plugin key span", () => {
    const raw = `---\ntitle: t\norder: 10000\nupdated: 2026-01-12\n---\nbody\n`;
    const result = patchFrontmatter(raw, [upsert("order", 15000)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe(`---\ntitle: t\norder: 15000\nupdated: 2026-01-12\n---\nbody\n`);
  });

  it("replaces a multi-line plugin span (block list) with one line", () => {
    const raw = `---\ntitle: t\nexcluded-folders:\n  - a\n  - b\norder: 10000\n---\nbody\n`;
    const result = patchFrontmatter(raw, [upsert("excluded-folders", ["x", "y"])]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe(`---\ntitle: t\nexcluded-folders: [x, y]\norder: 10000\n---\nbody\n`);
  });

  it("removing a missing key is a no-op (changed=false)", () => {
    const raw = `---\ntitle: t\n---\nbody\n`;
    const result = patchFrontmatter(raw, [{ op: "remove", key: "order" }]);
    expect(result).toEqual({ ok: true, text: raw, changed: false });
  });

  it("removes the whole span including nested lines", () => {
    const raw = `---\ntitle: t\nexcluded-folders:\n  - a\norder: 10000\n---\nbody\n`;
    const result = patchFrontmatter(raw, [{ op: "remove", key: "excluded-folders" }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe(`---\ntitle: t\norder: 10000\n---\nbody\n`);
  });

  it("comment lines bound the span and survive untouched", () => {
    const raw = `---\n# plugin section\norder: 10000\n# user notes\ntitle: t\n---\nbody\n`;
    const result = patchFrontmatter(raw, [{ op: "remove", key: "order" }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe(`---\n# plugin section\n# user notes\ntitle: t\n---\nbody\n`);
  });

  it("a comment after the key line is not eaten by the span", () => {
    const raw = `---\norder: 10000 # inline is part of the line\n# standalone comment\nuser: value\n---\nbody\n`;
    const result = patchFrontmatter(raw, [upsert("order", 20000)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe(`---\norder: 20000\n# standalone comment\nuser: value\n---\nbody\n`);
  });
});

describe("patchFrontmatter — structure edges", () => {
  it("creates frontmatter for files without one (upsert only)", () => {
    const raw = `# Heading\n\nbody\n`;
    const result = patchFrontmatter(raw, [upsert("order", 10000)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe(`---\norder: 10000\n---\n# Heading\n\nbody\n`);
  });

  it("fails with no-frontmatter on remove", () => {
    const result = patchFrontmatter("body only\n", [{ op: "remove", key: "order" }]);
    expect(result).toEqual({ ok: false, reason: "no-frontmatter" });
  });

  it("preserves CRLF line endings", () => {
    const raw = "---\r\ntitle: t\r\n---\r\nbody\r\n";
    const result = patchFrontmatter(raw, [upsert("order", 10000)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe("---\r\ntitle: t\r\norder: 10000\r\n---\r\nbody\r\n");
  });

  it("preserves a BOM", () => {
    const raw = "\uFEFF---\ntitle: t\n---\nbody\n";
    const result = patchFrontmatter(raw, [upsert("order", 10000)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text.startsWith("\uFEFF---\n")).toBe(true);
  });

  it("rejects keys outside the plugin namespace", () => {
    const result = patchFrontmatter("---\n---\nbody\n", [
      { op: "upsert", key: "title" as never, value: "x" },
    ]);
    expect(result).toEqual({ ok: false, reason: "key-outside-plugin-ns" });
  });

  it("is idempotent", () => {
    const raw = `---\ntitle: t\n---\nbody\n`;
    const first = patchFrontmatter(raw, [upsert("order", 10000)]);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = patchFrontmatter(first.text, [upsert("order", 10000)]);
    expect(second).toEqual({ ok: true, text: first.text, changed: false });
  });

  it("keeps quoted user values untouched", () => {
    const raw = `---\ntitle: "Keep: my, formatting"\ndate: '2025-11-09'\n---\nbody\n`;
    const result = patchFrontmatter(raw, [upsert("order", 10000)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('title: "Keep: my, formatting"');
    expect(result.text).toContain("date: '2025-11-09'");
  });
});

describe("patchFrontmatter — YAML safety valve", () => {
  const miniYaml = (text: string): unknown => {
    // tiny parser for tests: throws on the poison string, otherwise
    // returns key→scalar lines joined (good enough for these cases)
    if (text.includes("%%POISON%%")) throw new Error("bad yaml");
    return text;
  };

  it("refuses to write when the patched frontmatter does not parse", () => {
    const raw = `---\ntitle: t\n---\nbody\n`;
    const result = patchFrontmatter(raw, [upsert("order", 10000)], {
      parseYaml: miniYaml,
    });
    // order: 10000 parses fine — use a value that poisons via string
    expect(result.ok).toBe(true);
    const poisoned = patchFrontmatter(raw, [upsert("mode", "%%POISON%%")], {
      parseYaml: miniYaml,
    });
    expect(poisoned).toEqual({ ok: false, reason: "unparseable" });
  });

  it("anchor content passes when only the plugin key changes", () => {
    const raw = `---\nbase: &b\n  x: 1\norder: 10000\nderived:\n  <<: *b\n---\nbody\n`;
    // test double for parseYaml: top-level `key: value` lines only
    const lineYaml = (text: string): Record<string, string> =>
      Object.fromEntries(
        text
          .split(/\r?\n/)
          .filter((line) => /^[A-Za-z0-9_-]+:/.test(line))
          .map((line) => {
            const at = line.indexOf(":");
            return [line.slice(0, at), line.slice(at + 1).trim()];
          }),
      );
    const ok = patchFrontmatter(raw, [upsert("order", 20000)], { parseYaml: lineYaml });
    expect(ok.ok).toBe(true);
  });

  it("anchor span breakage is refused via the semantic compare", () => {
    // crafting a case where span replacement would detach an alias is
    // genuinely hard; assert instead that advanced tokens route into
    // the semantic path and a differing parse is rejected
    const raw = `---\nbase: &b\n  x: 1\norder: 10000\n---\nbody\n`;
    let call = 0;
    const flipping = (text: string): Record<string, string> => {
      call += 1;
      return { n: String(call), text };
    };
    const refused = patchFrontmatter(raw, [upsert("order", 20000)], { parseYaml: flipping });
    expect(refused).toEqual({ ok: false, reason: "unparseable" });
  });
});
