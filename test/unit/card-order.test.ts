import { describe, expect, it } from "vitest";
import type { ManagedDomain } from "../../src/types";
import { orderedDomains } from "../../src/ui/card-order";

function domain(root: string): ManagedDomain {
  return {
    root,
    mode: "series",
    indexPath: `${root}/目录.md`,
    entries: [],
    unmanagedFolders: [],
    excludedFolders: [],
    status: {
      broken: [],
      conflicts: [],
      pending: [],
      stale: false,
      ties: [],
      tightGap: false,
      legacyHint: false,
    },
  };
}

describe("orderedDomains (panel card drag order)", () => {
  it("orders roots by the persisted card order", () => {
    const domains = [domain("A"), domain("B"), domain("C")];
    expect(orderedDomains(domains, ["C", "A", "B"]).map((d) => d.root)).toEqual(["C", "A", "B"]);
  });

  it("unknown roots keep their original relative order at the end", () => {
    const domains = [domain("A"), domain("B"), domain("C")];
    expect(orderedDomains(domains, ["C"]).map((d) => d.root)).toEqual(["C", "A", "B"]);
    expect(orderedDomains(domains, ["B", "C"]).map((d) => d.root)).toEqual(["B", "C", "A"]);
  });

  it("empty order falls back to deterministic alphabetical order", () => {
    // the registry's Map insertion order changes across scans (file
    // renames resort the file list) — cards must never jump because of it
    const domains = [domain("随笔"), domain("Blogs"), domain("AI 答题应用平台")];
    expect(orderedDomains(domains, []).map((d) => d.root)).toEqual([
      "AI 答题应用平台",
      "Blogs",
      "随笔",
    ]);
  });
});
