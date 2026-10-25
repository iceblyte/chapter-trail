import { ChunkedWriter } from "../src/adapter/chunked-writer";
import { FakeVault } from "../src/adapter/fake-vault";
import type { ClockPort, ConfirmResult, ConfirmSpec } from "../src/adapter/ports";
import { RegistryStore } from "../src/adapter/registry-store";
import type { VaultSnapshot } from "../src/core/domain-resolver";
import { EchoLedger } from "../src/core/echo-ledger";
import { I18nService } from "../src/i18n/runtime";
import { PluginServices } from "../src/services";
import type { ChapterTrailSettings } from "../src/settings";
import { DEFAULT_SETTINGS } from "../src/settings";
import type { VaultPath } from "../src/types";

export interface NoteSpec {
  frontmatter?: Record<string, unknown>;
  body?: string;
}

export function makeSnapshot(notes: Record<string, NoteSpec>): VaultSnapshot {
  return {
    files: Object.entries(notes).map(([path, spec]) => ({
      path,
      frontmatter: spec.frontmatter ?? null,
    })),
    readFileBody: (path: string) => {
      const spec = notes[path];
      if (!spec) throw new Error(`no such note: ${path}`);
      return Promise.resolve(spec.body ?? "");
    },
  };
}

export function indexPageSpec(
  mode: "series" | "independent",
  extra?: Record<string, unknown>,
  inner = "",
): NoteSpec {
  return {
    frontmatter: { "is-index": true, mode, ...extra },
    body: `<!-- chapter-trail:begin -->\n${inner}\n<!-- chapter-trail:end -->\n`,
  };
}

/** Manual clock for debounce / TTL tests. */
export class FakeClock implements ClockPort {
  private currentTime = 0;
  private timers: { id: number; at: number; fn: () => void }[] = [];
  private nextId = 1;

  now(): number {
    return this.currentTime;
  }

  setTimeout(fn: () => void, ms: number): number {
    const id = this.nextId++;
    if (ms <= 0) {
      // zero-delay timers fire on the next microtask (writer yields)
      queueMicrotask(() => {
        if (this.timers.some((timer) => timer.id === id)) {
          this.timers = this.timers.filter((timer) => timer.id !== id);
          fn();
        }
      });
      this.timers.push({ id, at: this.currentTime, fn });
      return id;
    }
    this.timers.push({ id, at: this.currentTime + ms, fn });
    return id;
  }

  clearTimeout(id: number): void {
    this.timers = this.timers.filter((timer) => timer.id !== id);
  }

  /** advance time, firing due timers in order */
  advance(ms: number): void {
    const target = this.currentTime + ms;
    for (;;) {
      const due = this.timers.filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at);
      const next = due[0];
      if (!next) break;
      this.currentTime = next.at;
      this.timers = this.timers.filter((timer) => timer.id !== next.id);
      next.fn();
    }
    this.currentTime = target;
  }

  /** run every remaining timer chain */
  flush(): void {
    for (let guard = 0; guard < 1000 && this.timers.length > 0; guard++) {
      this.advance(50_000);
    }
  }
}

/** full index-page content with the plugin marker block */
export function indexPageContent(
  mode: "series" | "independent",
  extra?: Record<string, unknown>,
): string {
  const lines = ["---", "is-index: true", `mode: ${mode}`];
  for (const [key, value] of Object.entries(extra ?? {})) {
    lines.push(`${key}: ${value}`);
  }
  lines.push("---", "");
  return `${lines.join("\n")}\n<!-- chapter-trail:begin -->\n<!-- chapter-trail:end -->\n`;
}

export interface Harness {
  vault: FakeVault;
  clock: FakeClock;
  services: PluginServices;
  store: RegistryStore;
  settings: ChapterTrailSettings;
  notices: string[];
  confirmCalls: ConfirmSpec[];
  /** queue of scripted confirm results (shifted per dialog) */
  confirmScript: (ConfirmResult | undefined)[];
  setConfirmChoice(choice: ConfirmResult | undefined): void;
}

export function makeHarness(settingsPatch?: Partial<ChapterTrailSettings>): Harness {
  const vault = new FakeVault();
  const clock = new FakeClock();
  const notices: string[] = [];
  const confirmCalls: ConfirmSpec[] = [];
  const confirmScript: (ConfirmResult | undefined)[] = [];
  const settings: ChapterTrailSettings = { ...DEFAULT_SETTINGS, ...settingsPatch };
  const i18n = new I18nService("en");
  const ledger = new EchoLedger(clock, 5000);
  const writer = new ChunkedWriter(vault, clock, ledger);
  const store = new RegistryStore();
  const openedFiles: VaultPath[] = [];
  const services = new PluginServices(
    {
      vault,
      clock,
      notifier: { notice: (message: string) => notices.push(message) },
      confirm: {
        confirm: (spec: ConfirmSpec) => {
          confirmCalls.push(spec);
          const scripted = confirmScript.shift();
          if (scripted) return Promise.resolve(scripted);
          return Promise.resolve({ confirmed: true });
        },
      },
      i18n,
      writer,
      ledger,
      store,
      openFile: (path) => openedFiles.push(path),
    },
    settings,
  );
  return {
    vault,
    clock,
    services,
    store,
    settings,
    notices,
    confirmCalls,
    confirmScript,
    setConfirmChoice: (choice) => confirmScript.push(choice),
    openedFiles,
  } as Harness & { openedFiles: VaultPath[] };
}

/** seed a note with frontmatter serialized in the fake YAML subset */
export function note(order?: number, extra?: Record<string, unknown>, body = "正文\n"): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(extra ?? {})) {
    lines.push(`${key}: ${value}`);
  }
  if (order !== undefined) lines.push(`order: ${order}`);
  lines.push("---", "");
  return `${lines.join("\n")}\n${body}`;
}

export function orderOf(harness: Harness, path: VaultPath): number | undefined {
  const fm = harness.vault.getFrontmatter(path);
  const raw = fm?.order;
  return typeof raw === "number" ? raw : undefined;
}
