// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DynamicNav, type DynNavModel, dynNavModel } from "../../src/adapter/dynamic-nav";
import { I18nService } from "../../src/i18n/runtime";
import type { ManagedDomain } from "../../src/types";
import { emptyRegistry } from "../../src/types";

function seriesDomain(): ManagedDomain {
  return {
    root: "Blogs",
    mode: "series",
    indexPath: "Blogs/目录.md",
    entries: [
      { path: "Blogs/01.md", kind: "file", title: "01" },
      { path: "Blogs/02.md", kind: "file", title: "02" },
      { path: "Blogs/03.md", kind: "file", title: "03" },
    ],
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

describe("dynNavModel", () => {
  it("middle note has both neighbors; ends omit theirs", () => {
    const domain = seriesDomain();
    const middle = dynNavModel(domain, "Blogs/02.md");
    expect(middle?.prev?.path).toBe("Blogs/01.md");
    expect(middle?.next?.path).toBe("Blogs/03.md");
    expect(middle?.overview).toEqual({ path: "Blogs/目录.md", title: "目录" });

    const first = dynNavModel(domain, "Blogs/01.md");
    expect(first !== null && first.prev === undefined).toBe(true);
    const last = dynNavModel(domain, "Blogs/03.md");
    expect(last !== null && last.next === undefined).toBe(true);
  });

  it("returns null for notes outside the chain", () => {
    expect(dynNavModel(seriesDomain(), "Blogs/其他.md")).toBeNull();
  });
});

describe("DynamicNav.decorate (display-only)", () => {
  it("prepends and appends the nav box; click opens the target", () => {
    const opened: string[] = [];
    const nav = new DynamicNav(
      {} as never,
      {
        subscribe: () => (): void => {},
        getSnapshot: () => emptyRegistry(),
      } as never,
      new I18nService("en"),
      (path) => opened.push(path),
    );
    const sizer = document.createElement("div");
    sizer.className = "markdown-preview-sizer";
    sizer.appendChild(document.createElement("p"));
    const maybeModel = dynNavModel(seriesDomain(), "Blogs/02.md");
    if (!maybeModel) throw new Error("model missing");
    const model: DynNavModel = maybeModel;
    // exercise the private build via a public-ish cast
    const build = (nav as unknown as { build(m: typeof model): HTMLElement }).build.bind(nav);
    const box = build(model);
    sizer.prepend(box);
    sizer.append(build(model));

    const boxes = sizer.querySelectorAll(".ct-dyn-nav");
    expect(boxes.length).toBe(2);
    const firstBox = boxes[0];
    if (!firstBox) throw new Error("nav box missing");
    const links = [...firstBox.querySelectorAll("a")].map((a) => a.textContent);
    expect(links).toEqual(["01", "目录", "03"]);
    const overviewLink = firstBox.querySelectorAll("a")[1] as HTMLAnchorElement;
    overviewLink.click();
    expect(opened).toEqual(["Blogs/目录.md"]);
  });
});
