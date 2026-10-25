/**
 * EchoLedger — echo suppression (DESIGN.md §4.8 / §5.4).
 *
 * Before every write the writer registers the expected post-write
 * content hash; vault events arriving for that path whose content hash
 * hits the ledger within the TTL are the plugin's own echo and get
 * dropped. Judgement is content-idempotent, so duplicate modify +
 * metadataCache events are absorbed for free.
 */
import type { ClockPort } from "../adapter/ports";
import type { VaultPath } from "../types";

/** FNV-1a — fast, dependency-free, good enough for echo matching. */
export function contentHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36) + text.length.toString(36);
}

interface LedgerEntry {
  hashes: Set<string>;
  expiresAt: number;
}

export class EchoLedger {
  private entries = new Map<VaultPath, LedgerEntry>();
  private absent = new Map<VaultPath, number>();

  constructor(
    private readonly clock: ClockPort,
    private readonly ttlMs: number,
  ) {}

  /** Register the content the writer is about to produce. */
  register(path: VaultPath, contentAfterWrite: string): void {
    const hash = contentHash(contentAfterWrite);
    const existing = this.entries.get(path);
    if (existing) {
      existing.hashes.add(hash);
      existing.expiresAt = this.clock.now() + this.ttlMs;
      return;
    }
    this.entries.set(path, {
      hashes: new Set([hash]),
      expiresAt: this.clock.now() + this.ttlMs,
    });
  }

  /** Register a deletion / rename-away the plugin itself performed. */
  registerAbsent(path: VaultPath): void {
    this.absent.set(path, this.clock.now() + this.ttlMs);
  }

  /** True when a delete event for this path is the plugin's own. */
  isAbsentEcho(path: VaultPath): boolean {
    const until = this.absent.get(path);
    if (until === undefined) return false;
    if (until <= this.clock.now()) {
      this.absent.delete(path);
      return false;
    }
    return true;
  }

  /** True when the event is the plugin's own write echoing back. */
  isEcho(path: VaultPath, currentContent: string): boolean {
    this.sweep();
    const entry = this.entries.get(path);
    if (!entry) return false;
    return entry.hashes.has(contentHash(currentContent));
  }

  /** Drop expired entries (cheap, called on every probe). */
  private sweep(): void {
    const now = this.clock.now();
    for (const [path, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(path);
    }
  }
}
