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
    this.noteRenamed(path, newPath);
  }

  /** rename performed elsewhere (e.g. vault.rename via services):
   *  transfer the freshness override so reads of the new path are
   *  correct even before the metadata cache reindexes. */
  noteRenamed(oldPath: string, newPath: string): void {
    const fresh = this.freshWrites.get(oldPath);
    if (fresh) {
      this.freshWrites.delete(oldPath);
      this.freshWrites.set(newPath, { ...fresh, at: Date.now() });
    }
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
  constructor(
    private readonly app: App,
    /** language-aware fallback when a spec has no explicit cancelLabel */
    private readonly defaultCancelLabel: () => string = () => "Cancel",
  ) {}

  confirm(spec: ConfirmSpec): Promise<ConfirmResult> {
    return new Promise((resolve) => {
      new SpecModal(this.app, spec, resolve, this.defaultCancelLabel).open();
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
    private readonly defaultCancelLabel: () => string,
  ) {
    super(app);
    this.selected = spec.selectedOption;
  }

  onOpen(): void {
    this.titleEl.textContent = this.spec.title;
    this.renderBody(this.contentEl);
    this.renderControls(this.contentEl);
    this.modalEl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.finish({ confirmed: false });
    });
  }

  onClose(): void {
    this.finish({ confirmed: false });
  }

  private finish(result: ConfirmResult): void {
    if (this.resolved) return;
    this.resolved = true;
    this.resolve(result);
    // resolving alone left the modal on screen — always close it
    this.close();
  }

  private el(parent: HTMLElement, className: string, tag = "div"): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    parent.appendChild(node);
    return node;
  }

  private renderBody(el: HTMLElement): void {
    if (this.spec.body) {
      this.el(el, "ct-modal-body").innerHTML = this.spec.body;
    }
    if (this.spec.options && this.spec.options.length > 0) {
      const group = this.el(el, "ct-options");
      for (const option of this.spec.options) {
        this.renderOptionRow(group, option, false);
      }
    }
    if (this.spec.checkboxes && this.spec.checkboxes.length > 0) {
      const group = this.el(el, "ct-options");
      for (const box of this.spec.checkboxes) {
        this.renderOptionRow(group, box, true);
      }
    }
    if (this.spec.count) {
      this.el(el, "ct-modal-count").textContent = this.spec.count;
    }
    if (this.spec.warn) {
      this.el(el, "ct-modal-warn").innerHTML = this.spec.warn;
    }
    if (this.spec.danger) {
      this.el(el, "ct-modal-danger").innerHTML = this.spec.danger;
    }
  }

  private renderOptionRow(group: HTMLElement, option: ConfirmOption, checkbox: boolean): void {
    const selected = checkbox ? this.checked.has(option.id) : this.selected === option.id;
    const row = this.el(group, `ct-option${selected ? " is-selected" : ""}`);
    this.el(row, `ct-radio${checkbox ? " is-square" : ""}`, "span");
    const text = this.el(row, "");
    this.el(text, "ct-option-tt").innerHTML = option.label;
    if (option.description) {
      this.el(text, "ct-option-d").innerHTML = option.description;
    }
    row.addEventListener("click", () => {
      if (checkbox) {
        if (this.checked.has(option.id)) {
          this.checked.delete(option.id);
          row.classList.remove("is-selected");
        } else {
          this.checked.add(option.id);
          row.classList.add("is-selected");
        }
      } else {
        this.selected = option.id;
        for (const sibling of Array.from(group.children)) {
          sibling.classList.remove("is-selected");
        }
        row.classList.add("is-selected");
      }
    });
  }

  private renderControls(el: HTMLElement): void {
    const actions = this.el(el, "ct-modal-actions");
    const cancel = this.el(actions, "", "button") as HTMLButtonElement;
    cancel.type = "button";
    cancel.textContent = this.spec.cancelLabel ?? this.defaultCancelLabel();
    cancel.addEventListener("click", () => this.finish({ confirmed: false }));
    const ok = this.el(
      actions,
      this.spec.confirmDanger ? "mod-warning" : "mod-cta",
      "button",
    ) as HTMLButtonElement;
    ok.type = "button";
    ok.textContent = this.spec.confirmLabel;
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
