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

describe("coerceSettings — date source fields (bug 5/6/8)", () => {
  it("defaults match the 'Update modified date' plugin", () => {
    const s = coerceSettings({});
    expect(s.updatedProperty).toBe("updated");
    expect(s.createdProperty).toBe("created");
    expect(s.dateFormat).toBe("YYYY-MM-DD HH:mm");
  });

  it("a blank modified property falls back, a blank created property disables", () => {
    expect(coerceSettings({ updatedProperty: "  " }).updatedProperty).toBe("updated");
    expect(coerceSettings({ createdProperty: "" }).createdProperty).toBe("");
  });

  it("custom values are trimmed and kept", () => {
    const s = coerceSettings({
      updatedProperty: " 修改于 ",
      createdProperty: " 建立于 ",
      dateFormat: " YYYY/MM/DD ",
    });
    expect(s.updatedProperty).toBe("修改于");
    expect(s.createdProperty).toBe("建立于");
    expect(s.dateFormat).toBe("YYYY/MM/DD");
  });

  it("a blank date format falls back to the default", () => {
    expect(coerceSettings({ dateFormat: "" }).dateFormat).toBe("YYYY-MM-DD HH:mm");
  });
});

describe("coerceSettings — index date toggles + dissolve behavior (round 17)", () => {
  it("defaults: created shown, updated hidden, index deleted on dissolve", () => {
    const s = coerceSettings({});
    expect(s.indexShowCreated).toBe(true);
    expect(s.indexShowUpdated).toBe(false);
    expect(s.deleteIndexOnDissolve).toBe(true);
  });

  it("migrates the legacy dateDisplay dropdown", () => {
    expect(coerceSettings({ dateDisplay: "created" })).toMatchObject({
      indexShowCreated: true,
      indexShowUpdated: false,
    });
    expect(coerceSettings({ dateDisplay: "updated" })).toMatchObject({
      indexShowCreated: false,
      indexShowUpdated: true,
    });
    expect(coerceSettings({ dateDisplay: "both" })).toMatchObject({
      indexShowCreated: true,
      indexShowUpdated: true,
    });
    // explicit toggles always win over the legacy field
    expect(coerceSettings({ dateDisplay: "both", indexShowUpdated: false })).toMatchObject({
      indexShowUpdated: false,
    });
  });

  it("deleteIndexOnDissolve only turns off on an explicit false", () => {
    expect(coerceSettings({ deleteIndexOnDissolve: false }).deleteIndexOnDissolve).toBe(false);
    expect(coerceSettings({ deleteIndexOnDissolve: true }).deleteIndexOnDissolve).toBe(true);
  });
});
