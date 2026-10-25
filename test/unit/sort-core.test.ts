import { describe, expect, it } from "vitest";
import {
  detectTightGaps,
  midpointOrder,
  normalizedOrder,
  orderValue,
  planInsert,
  sortChain,
  tailOrder,
} from "../../src/core/sort-core";
import type { OrderEntry } from "../../src/types";

function entry(path: string, order?: number): OrderEntry {
  return order === undefined ? { path, kind: "file", title: path } : { path, kind: "file", title: path, order };
}

describe("orderValue whitelist", () => {
  it("accepts positive safe integers only", () => {
    expect(orderValue(10000)).toBe(10000);
    expect(orderValue(1)).toBe(1);
    expect(orderValue(0)).toBeUndefined();
    expect(orderValue(-5)).toBeUndefined();
    expect(orderValue(1.5)).toBeUndefined();
    expect(orderValue("10000")).toBeUndefined();
    expect(orderValue(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(orderValue(Number.MAX_SAFE_INTEGER + 2)).toBeUndefined();
    expect(orderValue(Number.NaN)).toBeUndefined();
  });
});

describe("sortChain", () => {
  it("sorts by order ascending", () => {
    const outcome = sortChain([entry("c.md", 30000), entry("a.md", 10000), entry("b.md", 20000)]);
    expect(outcome.sorted.map((e) => e.path)).toEqual(["a.md", "b.md", "c.md"]);
    expect(outcome.ties).toEqual([]);
    expect(outcome.pending).toEqual([]);
  });

  it("breaks ties with filename natural order and reports them", () => {
    const outcome = sortChain([
      entry("周记 10.md", 20000),
      entry("周记 2.md", 20000),
      entry("周记 1.md", 10000),
    ]);
    expect(outcome.sorted.map((e) => e.path)).toEqual(["周记 1.md", "周记 2.md", "周记 10.md"]);
    expect(new Set(outcome.ties)).toEqual(new Set(["周记 2.md", "周记 10.md"]));
  });

  it("puts members without order last, by filename", () => {
    const outcome = sortChain([
      entry("b.md", 20000),
      entry("new 2.md"),
      entry("new 10.md"),
      entry("a.md", 10000),
    ]);
    expect(outcome.sorted.map((e) => e.path)).toEqual(["a.md", "b.md", "new 2.md", "new 10.md"]);
    expect(outcome.pending).toEqual(["new 2.md", "new 10.md"]);
  });
});

describe("order math", () => {
  it("midpoint floors to integer", () => {
    expect(midpointOrder(10000, 20000)).toBe(15000);
    expect(midpointOrder(10000, 15000)).toBe(12500);
    expect(midpointOrder(30000, 40000)).toBe(35000);
  });

  it("tailOrder guards MAX_SAFE_INTEGER", () => {
    expect(tailOrder(10000)).toBe(20000);
    // at or beyond the MAX_SAFE_INTEGER - STEP margin the append is
    // refused and the caller normalizes instead (DESIGN.md 4.3)
    expect(tailOrder(Number.MAX_SAFE_INTEGER - STEP)).toBeNull();
    expect(tailOrder(Number.MAX_SAFE_INTEGER - STEP + 1)).toBeNull();
  });

  it("normalizedOrder walks the 10000 step", () => {
    expect(normalizedOrder(0)).toBe(10000);
    expect(normalizedOrder(4)).toBe(50000);
  });

  it("detectTightGaps flags gaps under the threshold", () => {
    expect(detectTightGaps([10000, 20000, 30000])).toBe(false);
    expect(detectTightGaps([10000, 10005, 30000])).toBe(true);
    expect(detectTightGaps([10000, 10000, 30000])).toBe(true); // tie counts
    expect(detectTightGaps([10000])).toBe(false);
  });
});

const STEP = 10000;

describe("planInsert", () => {
  it("plain middle move writes one midpoint", () => {
    const chain = [
      entry("a.md", 10000),
      entry("b.md", 20000),
      entry("c.md", 30000),
      entry("d.md", 40000),
    ];
    // move d between b and c → index 2 in the simulated chain
    const plan = planInsert(chain, "d.md", 2);
    expect(plan.normalized).toBe(false);
    expect(plan.writes.size).toBe(1);
    expect(plan.writes.get("d.md")).toBe(25000);
  });

  it("tight landing gap normalizes the whole domain first", () => {
    const chain = [
      entry("a.md", 10000),
      entry("b.md", 15000),
      entry("c.md", 15003),
      entry("d.md", 20000),
    ];
    // drag d between b and c (rest index 2 → landing gap 15000/15003 = 3)
    const plan = planInsert(chain, "d.md", 2);
    expect(plan.normalized).toBe(true);
    // new sequence a,b,d,c → 10000, 20000, 30000, 40000
    expect(plan.writes.get("b.md")).toBe(20000);
    expect(plan.writes.get("d.md")).toBe(30000);
    expect(plan.writes.get("c.md")).toBe(40000);
    // a.md already sits on its normalized value → not written
    expect(plan.writes.has("a.md")).toBe(false);
  });

  it("normalize writes only entries whose order actually changes", () => {
    const chain = [entry("a.md", 10000), entry("b.md", 10003)];
    // drag a after b → tail append on top of b's order
    const plan = planInsert(chain, "a.md", 1);
    expect(plan.normalized).toBe(false);
    expect(plan.writes.get("a.md")).toBe(20003);
    expect(plan.writes.has("b.md")).toBe(false);
  });

  it("dragging an ordered entry back to its own slot writes nothing", () => {
    const chain = [entry("a.md", 10000), entry("b.md", 20000)];
    const plan = planInsert(chain, "b.md", 1);
    expect(plan.writes.size).toBe(0);
  });

  it("tail append uses max + step", () => {
    const chain = [entry("a.md", 10000), entry("b.md", 20000)];
    const plan = planInsert(chain, "a.md", 1); // a moves to the tail
    expect(plan.normalized).toBe(false);
    expect(plan.writes.get("a.md")).toBe(30000);
  });

  it("head insert halves down when step-below would be zero", () => {
    const chain = [entry("a.md", 10000), entry("b.md", 20000)];
    const plan = planInsert(chain, "b.md", 0); // b moves to the head
    expect(plan.writes.get("b.md")).toBe(5000);
  });

  it("head insert below a larger first order uses a full step", () => {
    const chain = [entry("a.md", 30000), entry("b.md", 40000)];
    const plan = planInsert(chain, "b.md", 0);
    expect(plan.writes.get("b.md")).toBe(20000);
  });

  it("moving into an orderless neighborhood normalizes", () => {
    const chain = [entry("a.md", 10000), entry("b.md"), entry("c.md", 30000)];
    const plan = planInsert(chain, "b.md", 1);
    expect(plan.normalized).toBe(true);
    expect(plan.writes.get("b.md")).toBe(20000);
    // neighbors already on their normalized values are untouched
    expect(plan.writes.has("a.md")).toBe(false);
    expect(plan.writes.has("c.md")).toBe(false);
  });

  it("unknown entry is a no-op", () => {
    const plan = planInsert([entry("a.md", 10000)], "zz.md", 0);
    expect(plan.writes.size).toBe(0);
  });
});
