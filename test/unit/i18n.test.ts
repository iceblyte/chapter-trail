import { describe, expect, it } from "vitest";
import { en, interpolate, lookup, zh } from "../../src/i18n/index";
import { I18nService } from "../../src/i18n/runtime";

describe("i18n dictionaries", () => {
  it("en and zh expose identical key sets", () => {
    expect([...Object.keys(en)].sort()).toEqual([...Object.keys(zh)].sort());
  });

  it("every en value equals its key (English copy is the key)", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value).toBe(key);
    }
  });

  it("no zh value is empty", () => {
    for (const [key, value] of Object.entries(zh)) {
      expect(value.trim(), `empty translation for ${key}`).not.toBe("");
    }
  });

  it("placeholders present in keys survive translation", () => {
    const parametric = Object.keys(zh).filter((k) => /\{\w+\}/.test(k));
    expect(parametric.length).toBeGreaterThan(10);
    for (const key of parametric) {
      const placeholders = [...key.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const value = zh[key] ?? "";
      const translated = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(translated, `placeholder mismatch for key: ${key}`).toEqual(placeholders);
    }
  });
});

describe("interpolate", () => {
  it("substitutes params", () => {
    expect(interpolate("{n} of {total}", { n: 3, total: 9 })).toBe("3 of 9");
  });
  it("keeps unknown placeholders", () => {
    expect(interpolate("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});

describe("I18nService", () => {
  it("falls back to the key when a translation is missing", () => {
    const service = new I18nService("en");
    expect(service.t("Definitely not a real key")).toBe("Definitely not a real key");
  });
  it("translates and interpolates in zh", () => {
    const service = new I18nService("zh");
    expect(service.t("Index outdated")).toBe("索引过期");
    expect(service.t("{n} tied orders", { n: 2 })).toBe("2 个平手 order");
  });
  it("notifies subscribers on language switch", () => {
    const service = new I18nService("en");
    let fired = 0;
    const off = service.subscribe(() => fired++);
    service.setLang("zh");
    service.setLang("zh"); // no-op
    off();
    service.setLang("en");
    expect(fired).toBe(1);
    expect(lookup(zh, "Index outdated")).toBe("索引过期");
  });
});
