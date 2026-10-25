/**
 * EventSource — vault events → debounced, echo-filtered batches
 * (DESIGN.md §2.3 ②). The plugin's own writes are dropped via the
 * EchoLedger before anything is classified, and same-path events inside
 * a window collapse into one representative event.
 */

import { DEBOUNCE_MS } from "../constants";
import type { EchoLedger } from "../core/echo-ledger";
import type { ClockPort, RawVaultEvent, VaultPort } from "./ports";

export class EventSource {
  private unsubscribe: (() => void) | undefined;
  private pending = new Map<string, RawVaultEvent>();
  private timer: number | null = null;
  private windowStart = 0;
  private flushing = false;

  constructor(
    private readonly vault: VaultPort,
    private readonly clock: ClockPort,
    private readonly ledger: EchoLedger,
    private readonly debounceMs: number = DEBOUNCE_MS,
    private readonly maxWindowMs: number = DEBOUNCE_MS * 4,
  ) {}

  start(onBatch: (events: RawVaultEvent[]) => void | Promise<void>): void {
    this.unsubscribe = this.vault.onRawEvent((event) => {
      this.push(event);
      this.schedule(onBatch);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending.clear();
  }

  private push(event: RawVaultEvent): void {
    const key = event.path;
    const existing = this.pending.get(key);
    this.pending.set(key, merge(existing, event));
  }

  private schedule(onBatch: (events: RawVaultEvent[]) => void | Promise<void>): void {
    const now = this.clock.now();
    if (this.windowStart === 0) this.windowStart = now;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    const waited = now - this.windowStart;
    const delay = waited >= this.maxWindowMs ? 0 : this.debounceMs;
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      void this.flush(onBatch);
    }, delay);
  }

  private async flush(onBatch: (events: RawVaultEvent[]) => void | Promise<void>): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    this.windowStart = 0;
    const batch = [...this.pending.values()];
    this.pending.clear();
    try {
      const filtered: RawVaultEvent[] = [];
      for (const event of batch) {
        if (await this.isEcho(event)) continue;
        filtered.push(event);
      }
      if (filtered.length > 0) await onBatch(filtered);
    } finally {
      this.flushing = false;
    }
  }

  private async isEcho(event: RawVaultEvent): Promise<boolean> {
    if (event.type === "delete") return this.ledger.isAbsentEcho(event.path);
    if (event.type === "rename" && event.oldPath !== undefined) {
      return this.ledger.isAbsentEcho(event.oldPath);
    }
    if (event.type === "modify" || event.type === "create") {
      try {
        const content = await this.vault.read(event.path);
        return this.ledger.isEcho(event.path, content);
      } catch {
        // file already gone — let the classifier see the truth
        return false;
      }
    }
    return false;
  }
}

/** same-path merge: rename > create > delete > modify (keep semantic) */
function merge(existing: RawVaultEvent | undefined, next: RawVaultEvent): RawVaultEvent {
  if (!existing) return next;
  if (existing.type === "rename") return existing; // carries oldPath context
  if (next.type === "rename") return next;
  if (existing.type === "create" && next.type === "modify") return existing;
  if (existing.type === "delete" && next.type === "create") return next; // replaced file
  return next;
}
