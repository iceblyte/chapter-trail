import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { zh } from "../../src/i18n/index";

const srcRoot = fileURLToPath(new URL("../../src", import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** every t("...") key literal used anywhere in src/ must exist in zh */
describe("i18n source coverage", () => {
  it("all t() keys resolve in the zh dictionary", () => {
    const call = /(?<![A-Za-z0-9_$.])t\(\s*"((?:[^"\\]|\\.)*)"/g;
    const used = new Map<string, string[]>();
    for (const file of walk(srcRoot)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(call)) {
        const key = match[1] ?? "";
        const list = used.get(key) ?? [];
        list.push(file);
        used.set(key, list);
      }
    }
    expect(used.size).toBeGreaterThan(100); // scanner sanity
    const missing = [...used.keys()].filter((key) => zh[key] === undefined);
    expect(missing, `keys missing from zh.ts: ${missing.join(" | ")}`).toEqual([]);
  });
});
