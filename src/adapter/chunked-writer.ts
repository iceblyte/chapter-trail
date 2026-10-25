/**
 * ChunkedWriter — bulk writes in chunks with progress, cancellation and
 * failure collection (DESIGN.md §5.5). Every write registers the echo
 * ledger first so the plugin's own writes never cascade.
 */

import { WRITE_CHUNK } from "../constants";
import type { EchoLedger } from "../core/echo-ledger";
import type { VaultPath } from "../types";
import type { ClockPort, VaultPort } from "./ports";

export interface WriteTask {
  path: VaultPath;
  /** raw text → new text; returning the input unchanged skips the write */
  apply: (raw: string) => string;
}

export interface CancelSignal {
  isCancelled(): boolean;
}

export interface WriteRunOptions {
  /** progress callback (files processed, total) */
  onProgress?: (done: number, total: number) => void;
  cancel?: CancelSignal;
  chunkSize?: number;
}

export interface WriteRunResult {
  /** files whose content actually changed */
  written: VaultPath[];
  /** files that failed (locked etc.) — batch continues */
  failed: { path: VaultPath; error: string }[];
  cancelled: boolean;
}

export class ChunkedWriter {
  constructor(
    private readonly vault: VaultPort,
    private readonly clock: ClockPort,
    private readonly ledger: EchoLedger,
  ) {}

  async run(tasks: readonly WriteTask[], options: WriteRunOptions = {}): Promise<WriteRunResult> {
    const chunkSize = options.chunkSize ?? WRITE_CHUNK;
    const result: WriteRunResult = { written: [], failed: [], cancelled: false };
    let done = 0;

    for (let start = 0; start < tasks.length; start += chunkSize) {
      if (options.cancel?.isCancelled()) {
        result.cancelled = true;
        break;
      }
      const chunk = tasks.slice(start, start + chunkSize);
      for (const task of chunk) {
        try {
          const raw = await this.vault.read(task.path);
          const next = task.apply(raw);
          if (next !== raw) {
            this.ledger.register(task.path, next);
            await this.vault.process(task.path, () => next);
            result.written.push(task.path);
          }
        } catch (error) {
          result.failed.push({
            path: task.path,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        done += 1;
      }
      options.onProgress?.(done, tasks.length);
      // yield between chunks so the UI thread keeps breathing
      await new Promise<void>((resolve) => {
        this.clock.setTimeout(resolve, 0);
      });
    }
    return result;
  }
}
