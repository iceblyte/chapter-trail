import { describe, expect, it } from "vitest";
import { parseWhitelistedDate } from "../../src/core/date-whitelist";

describe("parseWhitelistedDate", () => {
  it.each([
    ["2025-11-09", "2025-11-09"],
    ["2026-01-12", "2026-01-12"],
    ["2025-11-09T10:30", "2025-11-09"],
    ["2025-11-09T10:30:59", "2025-11-09"],
    ["[[2025-11-09]]", "2025-11-09"],
    ["[[2025-11-09T10:30]]", "2025-11-09"],
    ["  2025-11-09  ", "2025-11-09"],
  ])("accepts %s", (input, expected) => {
    expect(parseWhitelistedDate(input)).toBe(expected);
  });

  it.each([
    "2025-13-01",
    "2025-00-10",
    "2025-02-30",
    "2023-02-29", // not a leap year
    "2025-11-32",
    "2025-11-09T24:00",
    "2025-11-09T10:60",
    "2025-11-09T10:30:60",
    "2025/11/09",
    "09-11-2025",
    "2025-11",
    "2025-11-09 extra",
    "",
    "   ",
  ])("rejects %s", (input) => {
    expect(parseWhitelistedDate(input)).toBeNull();
  });

  it("accepts leap-day in a leap year", () => {
    expect(parseWhitelistedDate("2024-02-29")).toBe("2024-02-29");
  });

  it("rejects non-string values", () => {
    expect(parseWhitelistedDate(20251109)).toBeNull();
    expect(parseWhitelistedDate(null)).toBeNull();
    expect(parseWhitelistedDate(undefined)).toBeNull();
    expect(parseWhitelistedDate({ date: "2025-11-09" })).toBeNull();
  });
});
