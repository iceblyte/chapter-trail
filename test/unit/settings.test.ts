import { describe, expect, it } from "vitest";
import { coerceSettings, defaultIndexName } from "../../src/settings";

describe("defaultIndexName (language-aware)", () => {
  it("目录 for zh, index for en", () => {
    expect(defaultIndexName("zh")).toBe("目录");
    expect(defaultIndexName("en")).toBe("index");
  });
});

describe("coerceSettings — index file name defaults", () => {
  it("fresh install: the default follows the UI language", () => {
    expect(coerceSettings({ language: "en" }).indexFileName).toBe("index");
    expect(coerceSettings({ language: "zh" }).indexFileName).toBe("目录");
  });

  it("migrates a stale pre-1.x default (目录 while language is en)", () => {
    expect(coerceSettings({ language: "en", indexFileName: "目录" }).indexFileName).toBe("index");
  });

  it("a manually customized name is never touched", () => {
    expect(coerceSettings({ language: "en", indexFileName: "toc" }).indexFileName).toBe("toc");
    expect(coerceSettings({ language: "zh", indexFileName: "toc" }).indexFileName).toBe("toc");
  });
});
