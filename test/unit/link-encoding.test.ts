import { describe, expect, it } from "vitest";
import { encodeLinkPath, relativeLink } from "../../src/core/path-util";

describe("encodeLinkPath (user-confirmed Quartz format)", () => {
  it("encodes spaces but keeps CJK and slashes", () => {
    expect(encodeLinkPath("文字教程/2 - MBTI 性格测试小程序.md")).toBe(
      "文字教程/2%20-%20MBTI%20性格测试小程序.md",
    );
  });

  it.each([
    ["a b.md", "a%20b.md"],
    ["a(b).md", "a%28b%29.md"],
    ["a&b.md", "a%26b.md"],
    ["a#b.md", "a%23b.md"],
    ["a%b.md", "a%25b.md"],
    ["a+b.md", "a%2Bb.md"],
    ["a?b.md", "a%3Fb.md"],
    ["a:b.md", "a%3Ab.md"],
    ["a@b.md", "a%40b.md"],
    ["a,b.md", "a%2Cb.md"],
    ["a;b.md", "a%3Bb.md"],
    ["a=b.md", "a%3Db.md"],
    ["a'b.md", "a%27b.md"],
    ['a"b.md', "a%22b.md"],
    ["a[b].md", "a%5Bb%5D.md"],
    ["a\b.md", "a\b.md"], // backslash is not a legal vault path char anyway
    ["a`b.md", "a%60b.md"],
    ["a^b.md", "a%5Eb.md"],
    ["a|b.md", "a%7Cb.md"],
    ["a{b}.md", "a%7Bb%7D.md"],
    ["a<b>.md", "a%3Cb%3E.md"],
    ["中文.md", "中文.md"],
    ["a_b-c.d~e!f$g*h.md", "a_b-c.d~e!f$g*h.md"],
  ])("%s → %s", (input, expected) => {
    expect(encodeLinkPath(input)).toBe(expected);
  });

  it("keeps path separators intact", () => {
    expect(encodeLinkPath("sub folder/note (1).md")).toBe("sub%20folder/note%20%281%29.md");
  });
});

describe("relativeLink (no ./ prefix, encoded)", () => {
  it("sibling file is a bare path", () => {
    expect(relativeLink("Blogs", "Blogs/02 环境搭建.md")).toBe("02%20环境搭建.md");
  });
  it("subfolder note links up with ../", () => {
    expect(relativeLink("Blogs/进阶篇", "Blogs/目录.md")).toBe("../目录.md");
  });
  it("index links down into a subfolder without ./", () => {
    expect(relativeLink("Blogs", "Blogs/进阶篇/04.md")).toBe("进阶篇/04.md");
  });
});
