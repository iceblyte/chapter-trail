/**
 * Obsidian implementations of the port seams (DESIGN.md §2.2).
 * This file is part of the adapter layer — the only layer allowed to
 * `import "obsidian"`.
 */
import { type App, type EventRef, Modal, Notice, parseYaml, TFolder } from "obsidian";
import { frontmatterText } from "../core/text-util";
import type {
  ClockPort,
  ConfirmOption,
  ConfirmPort,
  ConfirmResult,
  ConfirmSpec,
  NotifierPort,
  RawVaultEvent,
  VaultPort,
} from "./ports";

/** how long a self-written file bypasses the metadata cache */
const FRESH_TTL_MS = 30_000;

export class ObsidianVaultAdapter implements VaultPort {
  private handlers = new Set<(event: RawVaultEvent) => void>();
  private eventRefs: EventRef[] = [];
  private wired = false;
  /**
   * Files this process just wrote, keyed to their post-write content.
   * The metadata cache re-parses asynchronously, so reads immediately
   * after our own writes (e.g. the post-drag rescan) would otherwise
   * see stale frontmatter and the panel would not reorder.
   */
  private freshWrites = new Map<string, { content: string; at: number }>();

  constructor(private readonly app: App) {}

  listMarkdownFiles(): string[] {
    return this.app.vault.getMarkdownFiles().map((f) => f.path);
  }

  listFolders(): string[] {
    const out: string[] = [];
    const walk = (folder: TFolder): void => {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          out.push(child.path);
          walk(child);
        }
      }
    };
    walk(this.app.vault.getRoot());
    return out;
  }

  exists(path: string): boolean {
    return this.app.vault.getAbstractFileByPath(path) !== null;
  }

  async read(path: string): Promise<string> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) throw new Error(`read: file not found: ${path}`);
    return this.app.vault.cachedRead(file);
  }

  async process(path: string, fn: (data: string) => string): Promise<string> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) throw new Error(`process: file not found: ${path}`);
    const result = await this.app.vault.process(file, fn);
    this.freshWrites.set(path, { content: result, at: Date.now() });
    return result;
  }

  async create(path: string, content: string): Promise<void> {
    const already = this.app.vault.getAbstractFileByPath(path);
    if (already) throw new Error(`create: already exists: ${path}`);
    await this.app.vault.create(path, content);
    this.freshWrites.set(path, { content, at: Date.now() });
  }

  async rename(path: string, newPath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) throw new Error(`rename: file not found: ${path}`);
    await this.app.vault.rename(file, newPath);
  }

  async trashFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return;
    await this.app.vault.trash(file, true);
  }

  getFrontmatter(path: string): Record<string, unknown> | null | undefined {
    // our own recent writes win over the (eventually consistent) cache
    const fresh = this.freshWrites.get(path);
    if (fresh) {
      if (Date.now() - fresh.at <= FRESH_TTL_MS) {
        return parseWrittenFrontmatter(fresh.content);
      }
      this.freshWrites.delete(path);
    }
    const file = this.app.vault.getFileByPath(path);
    if (!file) return undefined;
    return this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
  }

  onRawEvent(handler: (event: RawVaultEvent) => void): () => void {
    this.handlers.add(handler);
    this.wireEvents();
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** must be called on plugin unload */
  dispose(): void {
    for (const ref of this.eventRefs) this.app.vault.offref(ref);
    this.eventRefs = [];
    this.handlers.clear();
    this.wired = false;
  }

  /** fires when the metadata cache has finished resolving (startup). */
  onCacheResolved(callback: () => void): () => void {
    const ref = this.app.metadataCache.on("resolved", callback);
    return () => this.app.metadataCache.offref(ref);
  }

  private emit(event: RawVaultEvent): void {
    for (const handler of this.handlers) handler(event);
  }

  private wireEvents(): void {
    if (this.wired) return;
    this.wired = true;
    const vault = this.app.vault;
    this.eventRefs.push(
      vault.on("create", (file) => {
        this.emit({ type: "create", path: file.path });
      }),
      vault.on("delete", (file) => {
        this.emit({ type: "delete", path: file.path });
      }),
      vault.on("rename", (file, oldPath) => {
        this.emit({ type: "rename", path: file.path, oldPath });
      }),
      vault.on("modify", (file) => {
        this.emit({ type: "modify", path: file.path });
      }),
    );
  }
}

export class SystemClockPort implements ClockPort {
  now(): number {
    return Date.now();
  }

  setTimeout(fn: () => void, ms: number): number {
    return window.setTimeout(fn, ms);
  }

  clearTimeout(id: number): void {
    window.clearTimeout(id);
  }
}

export class ObsidianNotifierPort implements NotifierPort {
  notice(message: string, ms?: number): void {
    new Notice(message, ms);
  }
}

/**
 * Generic ConfirmPort adapter — one Modal class renders every dialog spec
 * (radio cards, checkboxes, warn/danger boxes) so all dialogs share the
 * prototype's visual language (prototype 05).
 */
export class ObsidianConfirmPort implements ConfirmPort {
  constructor(private readonly app: App) {}

  confirm(spec: ConfirmSpec): Promise<ConfirmResult> {
    return new Promise((resolve) => {
      new SpecModal(this.app, spec, resolve).open();
    });
  }
}

class SpecModal extends Modal {
  private selected: string | undefined;
  private checked = new Set<string>();
  private resolved = false;

  constructor(
    app: App,
    private readonly spec: ConfirmSpec,
    private readonly resolve: (result: ConfirmResult) => void,
  ) {
    super(app);
    this.selected = spec.selectedOption;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    this.titleEl.setText(this.spec.title);
    this.renderBody(contentEl);
    this.renderControls(contentEl);
    modalEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.finish({ confirmed: false });
    });
  }

  onClose(): void {
    this.finish({ confirmed: false });
  }

  private finish(result: ConfirmResult): void {
    if (this.resolved) return;
    this.resolved = true;
    this.resolve(result);
  }

  private renderBody(el: HTMLElement): void {
    if (this.spec.body) {
      el.createEl("div", { cls: "ct-modal-body" }).innerHTML = this.spec.body;
    }
    if (this.spec.options && this.spec.options.length > 0) {
      const group = el.createEl("div", { cls: "ct-options" });
      for (const option of this.spec.options) {
        this.renderOptionRow(group, option, false);
      }
    }
    if (this.spec.checkboxes && this.spec.checkboxes.length > 0) {
      const group = el.createEl("div", { cls: "ct-options" });
      for (const box of this.spec.checkboxes) {
        this.renderOptionRow(group, box, true);
      }
    }
    if (this.spec.count) {
      el.createEl("div", { cls: "ct-modal-count" }).setText(this.spec.count);
    }
    if (this.spec.warn) {
      el.createEl("div", { cls: "ct-modal-warn" }).innerHTML = this.spec.warn;
    }
    if (this.spec.danger) {
      el.createEl("div", { cls: "ct-modal-danger" }).innerHTML = this.spec.danger;
    }
  }

  private renderOptionRow(group: HTMLElement, option: ConfirmOption, checkbox: boolean): void {
    const selected = checkbox ? this.checked.has(option.id) : this.selected === option.id;
    const row = group.createEl("div", { cls: `ct-option${selected ? " is-selected" : ""}` });
    row.createEl("span", { cls: `ct-radio${checkbox ? " is-square" : ""}` });
    const text = row.createEl("div");
    text.createEl("div", { cls: "ct-option-tt" }).innerHTML = option.label;
    if (option.description) {
      text.createEl("div", { cls: "ct-option-d" }).innerHTML = option.description;
    }
    row.addEventListener("click", () => {
      if (checkbox) {
        if (this.checked.has(option.id)) {
          this.checked.delete(option.id);
          row.removeClass("is-selected");
        } else {
          this.checked.add(option.id);
          row.addClass("is-selected");
        }
      } else {
        this.selected = option.id;
        for (const sibling of Array.from(group.children)) sibling.removeClass("is-selected");
        row.addClass("is-selected");
      }
    });
  }

  private renderControls(el: HTMLElement): void {
    const actions = el.createEl("div", { cls: "ct-modal-actions" });
    const cancel = actions.createEl("button", {
      text: this.spec.cancelLabel ?? "Cancel",
    });
    cancel.addEventListener("click", () => this.finish({ confirmed: false }));
    const ok = actions.createEl("button", {
      cls: this.spec.confirmDanger ? "mod-warning" : "mod-cta",
      text: this.spec.confirmLabel,
    });
    ok.addEventListener("click", () => {
      this.finish({
        confirmed: true,
        option: this.selected,
        checked: [...this.checked],
      });
    });
  }
}

/**
 * Parse the frontmatter of content this process just wrote. Any parse
 * failure falls back to null (treated as "no frontmatter") — the same
 * semantics as a cache miss, never an exception.
 */
function parseWrittenFrontmatter(content: string): Record<string, unknown> | null {
  const yaml = frontmatterText(content);
  if (yaml === null || yaml.trim() === "") return null;
  try {
    const parsed = parseYaml(yaml);
    if (parsed === null || parsed === undefined) return null;
    return typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
