import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATE_OPTIONS,
  formatDateValue,
  parseAndFormatDate,
  parseDateValue,
  readEntryDates,
} from "../../src/core/date-value";

describe("parseDateValue — accepted shapes", () => {
  it.each([
    ["2025-11-09", { year: 2025, month: 11, day: 9 }],
    ["2026-01-12", { year: 2026, month: 1, day: 12 }],
    ["2025-11-09T10:30", { hour: 10, minute: 30 }],
    ["2025-11-09T10:30:59", { hour: 10, minute: 30, second: 59 }],
    ["2025-11-09T10:30:59.123", { hour: 10, minute: 30, second: 59 }],
    // the reported real-world shape: space separator, no seconds (bug 6)
    ["2026-09-04 23:40", { hour: 23, minute: 40 }],
    ["2026-09-04 23:40:08", { hour: 23, minute: 40, second: 8 }],
    ["[[2025-11-09]]", { year: 2025, month: 11, day: 9 }],
    ["[[2025-11-09T10:30]]", { hour: 10, minute: 30 }],
    ["  2025-11-09  ", { year: 2025, month: 11, day: 9 }],
    ["2025/11/09", { year: 2025, month: 11, day: 9 }],
    ["2025.11.09", { year: 2025, month: 11, day: 9 }],
    ["2025.3.7", { year: 2025, month: 3, day: 7 }],
    ["2026-09-04 23:40+08:00", { hour: 23, minute: 40 }],
    ["2026-09-04T23:40:08Z", { hour: 23, minute: 40, second: 8 }],
  ])("accepts %s", (input, extra) => {
    const parsed = parseDateValue(input);
    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject(extra);
  });

  it("accepts leap-day in a leap year", () => {
    expect(parseDateValue("2024-02-29")).toMatchObject({ year: 2024, month: 2, day: 29 });
  });

  it("accepts YAML Date objects (date-only = UTC midnight)", () => {
    const parsed = parseDateValue(new Date(Date.UTC(2026, 7, 28)));
    expect(parsed).toMatchObject({ year: 2026, month: 8, day: 28, hasTime: false });
  });

  it("accepts YAML Date objects with a time part (local fields)", () => {
    const parsed = parseDateValue(new Date(2026, 8, 4, 23, 40, 8));
    expect(parsed).toMatchObject({
      year: 2026,
      month: 9,
      day: 4,
      hour: 23,
      minute: 40,
      second: 8,
      hasTime: true,
    });
  });

  it("accepts epoch numbers at plausible magnitudes", () => {
    expect(parseDateValue(1_767_225_600_000)).toMatchObject({ year: 2026, month: 1, day: 1 });
    expect(parseDateValue(1_767_225_600)).toMatchObject({ year: 2026, month: 1, day: 1 });
  });
});

describe("parseDateValue — rejected shapes", () => {
  it.each([
    "2025-13-01",
    "2025-00-10",
    "2025-02-30",
    "2023-02-29", // not a leap year
    "2025-11-32",
    "2025-11-09T24:00",
    "2025-11-09T10:60",
    "2025-11-09T10:30:60",
    "09-11-2025",
    "2025-11",
    "2025-11-09 extra",
    "不知何时",
    "",
    "   ",
  ])("rejects %s", (input) => {
    expect(parseDateValue(input)).toBeNull();
  });

  it("rejects non-string non-date values and out-of-range epochs", () => {
    expect(parseDateValue(20251109)).toBeNull(); // not an epoch magnitude
    expect(parseDateValue(null)).toBeNull();
    expect(parseDateValue(undefined)).toBeNull();
    expect(parseDateValue({ date: "2025-11-09" })).toBeNull();
  });
});

describe("formatDateValue — moment-style tokens", () => {
  /** parse (asserting success) then format */
  function fmt(input: unknown, format: string): string {
    const parsed = parseDateValue(input);
    if (!parsed) throw new Error(`unparsable test input: ${String(input)}`);
    return formatDateValue(parsed, format);
  }

  it("renders the default format, keeping the value's own precision", () => {
    expect(fmt("2026-09-04 23:40", "")).toBe("2026-09-04 23:40");
    // a pure date never grows a time part
    expect(fmt("2026-08-28", "")).toBe("2026-08-28");
  });

  it("supports user formats", () => {
    expect(fmt("2026-09-04 23:40", "YYYY/MM/DD")).toBe("2026/09/04");
    expect(fmt("2026-09-04 23:40", "YY-MM-DD HH:mm")).toBe("26-09-04 23:40");
    expect(fmt("2026-09-04 23:40", "YYYY-MM-DD HH:mm:ss")).toBe("2026-09-04 23:40:00");
    expect(fmt("2025-11-09", "YYYY年MM月DD日")).toBe("2025年11月09日");
  });

  it("falls back to a plain date when the format is time-only", () => {
    expect(fmt("2025-11-09", "HH:mm")).toBe("2025-11-09");
  });
});

describe("parseAndFormatDate", () => {
  it("formats recognized values and fails closed", () => {
    expect(parseAndFormatDate("2026-09-04 23:40", "YYYY-MM-DD HH:mm")).toBe("2026-09-04 23:40");
    expect(parseAndFormatDate("nope", "YYYY-MM-DD")).toBeNull();
  });
});

describe("readEntryDates — configurable property names", () => {
  it("reads the default keys", () => {
    expect(
      readEntryDates({ created: "2026-08-28", updated: "2026-09-04 23:40" }, DEFAULT_DATE_OPTIONS),
    ).toEqual({ created: "2026-08-28", updated: "2026-09-04 23:40" });
  });

  it("reads custom keys and applies the format", () => {
    expect(
      readEntryDates(
        { 建立日期: "2026/08/28", 修改日期: "2026-09-04 23:40" },
        { createdKey: "建立日期", updatedKey: "修改日期", format: "YYYY/MM/DD" },
      ),
    ).toEqual({ created: "2026/08/28", updated: "2026/09/04" });
  });

  it("an empty created key disables created reading", () => {
    expect(
      readEntryDates(
        { created: "2026-08-28", updated: "2026-09-04" },
        {
          ...DEFAULT_DATE_OPTIONS,
          createdKey: "",
        },
      ),
    ).toEqual({ updated: "2026-09-04" });
  });

  it("returns undefined when nothing is parsable", () => {
    expect(readEntryDates({ created: "nope" }, DEFAULT_DATE_OPTIONS)).toBeUndefined();
    expect(readEntryDates(null, DEFAULT_DATE_OPTIONS)).toBeUndefined();
  });
});
