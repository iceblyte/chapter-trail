/**
 * DynamicNav — renders the prev / overview / next callout into the
 * active reading view WITHOUT writing any file (user decision
 * 2026-10-25: navigation should be visible while injection is off;
 * the zero-write invariant is preserved — this is display-only).
 *
 * The injection setting keeps its exact meaning: when enabled, the
 * same nav is written into the notes (Quartz-publishable). The
 * dynamic layer only decorates Obsidian's reading view DOM.
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

export class DynamicNav {
  private disposers: (() => void)[] = [];
  private detachStore: (() => void) | null = null;
  private timer: number | null = null;

  constructor(
    private readonly app: App,
    private readonly store: RegistryStore,
    private readonly i18n: I18nService,
    private readonly openFile: (path: VaultPath) => void,
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

  private apply(): void {
    const view = (this.app as { workspace: unknown }).workspace as {
      getActiveViewOfType(
        type: unknown,
      ): { file?: { path: string }; contentEl: HTMLElement } | null;
    };
    const markdown = view.getActiveViewOfType(MarkdownView);
    if (!markdown?.file) return;
    const sizer = markdown.contentEl.querySelector<HTMLElement>(".markdown-preview-sizer");
    if (!sizer) return; // source / live-preview mode: nothing to decorate

    this.clear(sizer);
    const registry = this.store.getSnapshot();
    let best: ManagedDomain | null = null;
    for (const domain of registry.domains.values()) {
      if (!isUnder(markdown.file.path, domain.root)) continue;
      if (!best || domain.root.length > best.root.length) best = domain;
    }
    if (!best) return;
    const model = dynNavModel(best, markdown.file.path);
    if (!model) return;
    sizer.prepend(this.build(model));
    sizer.append(this.build(model));
  }

  private clear(sizer: HTMLElement): void {
    for (const node of sizer.querySelectorAll(":scope > .ct-dyn-nav")) {
      node.remove();
    }
  }

  private build(model: DynNavModel): HTMLElement {
    const box = document.createElement("div");
    box.className = "ct-dyn-nav";
    const t = (key: string) => this.i18n.t(key);
    const parts: HTMLElement[] = [];
    if (model.prev) parts.push(this.slot(t("上一篇："), model.prev));
    parts.push(this.slot(t("总览："), model.overview));
    if (model.next) parts.push(this.slot(t("下一篇："), model.next));
    parts.forEach((part, index) => {
      if (index > 0) {
        box.appendChild(document.createTextNode(" | "));
      }
      box.appendChild(part);
    });
    return box;
  }

  private slot(label: string, target: { path: VaultPath; title: string }): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "ct-dyn-slot";
    wrap.append(document.createTextNode(label));
    const link = document.createElement("a");
    link.textContent = target.title;
    link.href = "#";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      this.openFile(target.path);
    });
    wrap.appendChild(link);
    return wrap;
  }
}
