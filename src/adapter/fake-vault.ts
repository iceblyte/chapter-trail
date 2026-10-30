/**
 * FakeVault — in-memory VaultPort for tests (DESIGN.md §3.8).
 * Emits the same raw events a real vault would, parses a small YAML
 * subset for getFrontmatter (or takes explicit overrides), and keeps a
 * full event log plus a byte-stable snapshot for A3/A8 assertions.
 */

import type { VaultPath } from "../types";
import type { RawVaultEvent, VaultPort } from "./ports";

/** Minimal YAML subset: top-level scalars, flow lists, block lists. */
export function parseFrontmatterNaive(text: string): Record<string, unknown> | null {
  const normalized = text.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) return null;
  const _eol = normalized.includes("\r\n") ? "\r\n" : "\n";
  const lines = normalized.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") {
      return result;
    }
    const kv = /^([A-Za-z0-9_-]+):[ \t]?(.*)$/.exec(line);
    if (kv?.[1] !== undefined && !line.startsWith(" ") && !line.startsWith("-")) {
      if (currentList && currentKey) {
        result[currentKey] = currentList;
        currentList = null;
        currentKey = null;
      }
      const value = kv[2]?.trim() ?? "";
      if (value === "") {
        // may become a block list
        currentKey = kv[1];
        currentList = null;
        continue;
      }
      result[kv[1]] = parseScalar(value);
      continue;
    }
    const listItem = /^\s+-\s+(.*)$/.exec(line);
    if (listItem?.[1] !== undefined && currentKey) {
      currentList = currentList ?? [];
      currentList.push(String(unwrapQuotes(listItem[1].trim())));
    }
  }
  return null; // unterminated frontmatter
}

function parseScalar(raw: string): unknown {
  const value = unwrapQuotes(raw);
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => unwrapQuotes(item.trim()))
      .filter((item) => item !== "");
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function unwrapQuotes(raw: string): string {
  if (
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

export class FakeVault implements VaultPort {
  private files = new Map<VaultPath, string>();
  private folders = new Set<VaultPath>();
  private frontmatterOverrides = new Map<VaultPath, Record<string, unknown> | null>();
  private handlers = new Set<(event: RawVaultEvent) => void>();
  readonly events: RawVaultEvent[] = [];

  write(path: VaultPath, content: string): void {
    const had = this.files.has(path);
    this.files.set(path, content);
    const folder = path.slice(0, path.lastIndexOf("/"));
    if (folder) this.ensureFolder(folder);
    this.emit({ type: had ? "modify" : "create", path });
  }

  /** seed without emitting events (initial vault state) */
  seed(path: VaultPath, content: string): void {
    this.files.set(path, content);
    const folder = path.slice(0, path.lastIndexOf("/"));
    if (folder) this.ensureFolder(folder);
  }

  seedFolder(path: VaultPath): void {
    this.ensureFolder(path);
  }

  setFrontmatter(path: VaultPath, frontmatter: Record<string, unknown> | null): void {
    this.frontmatterOverrides.set(path, frontmatter);
  }

  snapshot(): Map<VaultPath, string> {
    return new Map(this.files);
  }

  readContent(path: VaultPath): string {
    return this.files.get(path) ?? "";
  }

  exists(path: VaultPath): boolean {
    // folders count too: the classifier checks whether a managed
    // domain's ROOT FOLDER still exists after a rename batch
    return this.files.has(path) || this.folders.has(path);
  }

  listMarkdownFiles(): VaultPath[] {
    return [...this.files.keys()].filter((path) => path.endsWith(".md")).sort();
  }

  listFolders(): VaultPath[] {
    return [...this.folders].sort();
  }

  async read(path: VaultPath): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`read: no such file: ${path}`);
    return content;
  }

  async process(path: VaultPath, fn: (data: string) => string): Promise<string> {
    const current = this.files.get(path);
    if (current === undefined) throw new Error(`process: no such file: ${path}`);
    const next = fn(current);
    this.files.set(path, next);
    this.emit({ type: "modify", path });
    return next;
  }

  async create(path: VaultPath, content: string): Promise<void> {
    if (this.files.has(path)) throw new Error(`create: already exists: ${path}`);
    this.files.set(path, content);
    const folder = path.slice(0, path.lastIndexOf("/"));
    if (folder) this.ensureFolder(folder);
    this.emit({ type: "create", path });
  }

  async rename(path: VaultPath, newPath: VaultPath): Promise<void> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`rename: no such file: ${path}`);
    this.files.delete(path);
    this.files.set(newPath, content);
    const folder = newPath.slice(0, newPath.lastIndexOf("/"));
    if (folder) this.ensureFolder(folder);
    this.emit({ type: "rename", path: newPath, oldPath: path });
  }

  /**
   * Simulate the host moving a whole folder: re-key every file inside
   * and emit a rename for the folder AND one per child file — exactly
   * what Obsidian's vault does (the classifier's missing-root fix and
   * its regression tests rely on this behavior).
   */
  moveFolder(oldPath: VaultPath, newPath: VaultPath): void {
    if (oldPath === "" || newPath === "" || newPath.startsWith(`${oldPath}/`)) {
      throw new Error(`moveFolder: bad move: ${oldPath} -> ${newPath}`);
    }
    const moves = new Map<VaultPath, VaultPath>();
    for (const path of [...this.files.keys(), ...this.frontmatterOverrides.keys()]) {
      if (path === oldPath || path.startsWith(`${oldPath}/`)) {
        moves.set(path, path === oldPath ? newPath : `${newPath}${path.slice(oldPath.length)}`);
      }
    }
    for (const [from, to] of moves) {
      if (this.files.has(from)) {
        this.files.set(to, this.files.get(from) ?? "");
        this.files.delete(from);
      }
      if (this.frontmatterOverrides.has(from)) {
        this.frontmatterOverrides.set(to, this.frontmatterOverrides.get(from) ?? null);
        this.frontmatterOverrides.delete(from);
      }
    }
    for (const folder of [...this.folders]) {
      if (folder === oldPath || folder.startsWith(`${oldPath}/`)) {
        this.folders.delete(folder);
        this.folders.add(
          folder === oldPath ? newPath : `${newPath}${folder.slice(oldPath.length)}`,
        );
      }
    }
    this.ensureFolder(newPath);
    this.emit({ type: "rename", path: newPath, oldPath });
    for (const [from, to] of moves) {
      this.emit({ type: "rename", path: to, oldPath: from });
    }
  }

  async trashFile(path: VaultPath): Promise<void> {
    if (this.files.delete(path)) {
      this.frontmatterOverrides.delete(path);
      this.emit({ type: "delete", path });
    }
  }

  noteRenamed(_oldPath: VaultPath, _newPath: VaultPath): void {
    // the in-memory model is already consistent
  }

  getFrontmatter(path: VaultPath): Record<string, unknown> | null | undefined {
    if (this.frontmatterOverrides.has(path)) {
      return this.frontmatterOverrides.get(path) ?? null;
    }
    const content = this.files.get(path);
    if (content === undefined) return undefined;
    return parseFrontmatterNaive(content);
  }

  onRawEvent(handler: (event: RawVaultEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: RawVaultEvent): void {
    this.events.push(event);
    for (const handler of this.handlers) handler(event);
  }

  private ensureFolder(folder: VaultPath): void {
    this.folders.add(folder);
    const parent = folder.slice(0, folder.lastIndexOf("/"));
    if (parent) this.ensureFolder(parent);
  }
}
