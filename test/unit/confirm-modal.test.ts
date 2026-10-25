// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

/* obsidian is aliased to test/obsidian-mock.ts (see vitest.config.ts);
 * SpecModal renders plain DOM into the stub's Modal shell. */

import { ObsidianConfirmPort } from "../../src/adapter/obsidian-adapters";
import type { ConfirmResult } from "../../src/adapter/ports";

function buttonByText(text: string): HTMLButtonElement {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!btn) throw new Error(`button not found: ${text}`);
  return btn as HTMLButtonElement;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("SpecModal cancel label follows the language (fix: 'Cancel' residue)", () => {
  it("uses the provider for the default cancel label and closes on click", async () => {
    const port = new ObsidianConfirmPort({} as never, () => "取消");
    const pending: Promise<ConfirmResult> = port.confirm({
      title: "重建索引",
      confirmLabel: "重建",
    });

    expect(buttonByText("取消")).toBeTruthy();
    expect([...document.querySelectorAll("button")].some((b) => b.textContent === "Cancel")).toBe(
      false, // no residue
    );

    buttonByText("取消").click();
    const result = await pending;
    expect(result.confirmed).toBe(false);
    expect(document.querySelector(".ct-modal-body")).toBeNull(); // modal closed
  });

  it("an explicit cancelLabel still wins over the provider", async () => {
    const port = new ObsidianConfirmPort({} as never, () => "取消");
    const pending = port.confirm({
      title: "Remove all",
      confirmLabel: "Next",
      cancelLabel: "Back",
    });
    expect(buttonByText("Back")).toBeTruthy();
    buttonByText("Back").click();
    const result = await pending;
    expect(result.confirmed).toBe(false);
  });

  it("confirm closes the modal too (regression: dialog stayed open)", async () => {
    const port = new ObsidianConfirmPort({} as never, () => "取消");
    const pending = port.confirm({ title: "t", confirmLabel: "ok" });
    buttonByText("ok").click();
    const result = await pending;
    expect(result.confirmed).toBe(true);
    expect(document.querySelector(".ct-modal-body")).toBeNull();
  });
});
