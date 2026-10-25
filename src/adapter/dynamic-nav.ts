/**
 * DynamicNav — renders the prev / overview / next callout into the
 * active reading view WITHOUT writing any file (user decision
 * 2026-10-25: navigation should be visible while injection is off;
 * the zero-write invariant is preserved — this is display-only).
 *
 * Obsidian's preview re-renders its sections asynchronously after a
 * file opens and remounts them while scrolling — anything we prepend
 * is wiped moments later. A MutationObserver on the preview sizer
 * re-applies the decoration whenever that happens (the previous
 * fire-once approach is why the nav "disappeared" after jumps).
 */
import { type App, MarkdownView } from "obsidian";
import { isUnder } from "../core/path-util";
import type { I18nService } from "../i18n/runtime";
import type { ManagedDomain, VaultPath } from "../types";
import type { RegistryStore } from "./registry-store";

export interface DynNavModel {
  prev?: { path: VaultPath; title: string } | undefined;
  next?: { path: VaultPath; title: string } | undefined;
  overview: { path: VaultPath; title: string };
}

/** pure: which neighbors surround `path` inside its chain? */
export function dynNavModel(domain: ManagedDomain, path: VaultPath): DynNavModel | null {
  const files = domain.entries.filter((entry) => entry.kind === "file");
  const index = files.findIndex((entry) => entry.path === path);
  if (index === -1) return null;
  const indexTitle = domain.indexPath
    .slice(domain.indexPath.lastIndexOf("/") + 1)
    .replace(/\.md$/, "");
  return {
    prev: index > 0 ? files[index - 1] : undefined,
    next: index < files.length - 1 ? files[index + 1] : undefined,
    overview: { path: domain.indexPath, title: indexTitle },
  };
}

export interface NavDeps {
  i18n: I18nService;
  openFile: (path: VaultPath) => void;
}

/** Build the nav box DOM (shared by the reading view and the CM6 editor widget). */
export function buildNavBox(model: DynNavModel, deps: NavDeps): HTMLElement {
  const box = document.createElement("div");
  box.className = "ct-dyn-nav";
  const t = (key: string) => deps.i18n.t(key);
  const parts: HTMLElement[] = [];
  if (model.prev) parts.push(buildSlot(t("上一篇："), model.prev, deps));
  parts.push(buildSlot(t("总览："), model.overview, deps));
  if (model.next) parts.push(buildSlot(t("下一篇："), model.next, deps));
  parts.forEach((part, index) => {
    if (index > 0) box.appendChild(document.createTextNode(" | "));
    box.appendChild(part);
  });
  return box;
}

function buildSlot(
  label: string,
  target: { path: VaultPath; title: string },
  deps: NavDeps,
): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "ct-dyn-slot";
  wrap.append(document.createTextNode(label));
  const link = document.createElement("a");
  link.textContent = target.title;
  link.href = "#";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    deps.openFile(target.path);
  });
  wrap.appendChild(link);
  return wrap;
}

export class DynamicNav {
  private disposers: (() => void)[] = [];
  private detachStore: (() => void) | null = null;
  private timer: number | null = null;
  private observer: MutationObserver | null = null;
  private observedEl: HTMLElement | null = null;
  private lastPath: string | null = null;
  private lastSnapshot: unknown = null;
  /** swallow the mutation storm our own decoration triggers */
  private suppressUntil = 0;

  constructor(
    private readonly app: App,
    private readonly store: RegistryStore,
    private readonly deps: NavDeps,
  ) {}

  start(): void {
    const workspace = (this.app as { workspace: unknown }).workspace as {
      on(name: string, cb: () => void): unknown;
      offref(ref: unknown): void;
    };
    for (const eventName of ["file-open", "layout-change", "active-leaf-change"]) {
      const ref = workspace.on(eventName, () => this.schedule());
      this.disposers.push(() => workspace.offref(ref));
    }
    this.detachStore = this.store.subscribe(() => this.schedule());
    this.schedule();
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.detachStore?.();
    this.detachStore = null;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.observer?.disconnect();
    this.observer = null;
    this.observedEl = null;
    for (const node of document.querySelectorAll(".ct-dyn-nav")) {
      node.remove();
    }
  }

  private schedule(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.apply();
    }, 120);
  }

  /** observer path: content was (re)rendered — re-decorate next frame */
  private scheduleSoon(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.apply();
    }, 30);
  }

  private apply(): void {
    const workspace = (this.app as { workspace: unknown }).workspace as {
      getActiveViewOfType(
        type: unknown,
      ): { file?: { path: string }; contentEl: HTMLElement } | null;
    };
    const markdown = workspace.getActiveViewOfType(MarkdownView);
    if (!markdown?.file) return;
    const sizer = markdown.contentEl.querySelector<HTMLElement>(".markdown-preview-sizer");
    if (!sizer) return; // source / live-preview mode: the CM extension handles it

    if (this.observedEl !== sizer) {
      this.observer?.disconnect();
      this.observer = new MutationObserver(() => {
        if (Date.now() < this.suppressUntil) return;
        this.scheduleSoon();
      });
      this.observer.observe(sizer, { childList: true });
      this.observedEl = sizer;
    }

    const registry = this.store.getSnapshot();
    let best: ManagedDomain | null = null;
    for (const domain of registry.domains.values()) {
      if (!isUnder(markdown.file.path, domain.root)) continue;
      if (!best || domain.root.length > best.root.length) best = domain;
    }
    const model = best ? dynNavModel(best, markdown.file.path) : null;

    // already decorated for this exact file & registry — nothing to do
    const alreadyHere = sizer.querySelector(":scope > .ct-dyn-nav") !== null;
    if (alreadyHere && this.lastPath === markdown.file.path && this.lastSnapshot === registry) {
      return;
    }

    this.suppressUntil = Date.now() + 150;
    this.clear(sizer);
    if (!model) {
      this.lastPath = null;
      return;
    }
    sizer.prepend(buildNavBox(model, this.deps));
    sizer.append(buildNavBox(model, this.deps));
    this.lastPath = markdown.file.path;
    this.lastSnapshot = registry;
  }

  private clear(sizer: HTMLElement): void {
    for (const node of sizer.querySelectorAll(":scope > .ct-dyn-nav")) {
      node.remove();
    }
  }
}
