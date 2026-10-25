import { describe, expect, it } from "vitest";
import { EventSource } from "../../src/adapter/event-source";
import { FakeVault } from "../../src/adapter/fake-vault";
import { DEBOUNCE_MS } from "../../src/constants";
import { EchoLedger } from "../../src/core/echo-ledger";
import { FakeClock } from "../helpers";

function setup() {
  const vault = new FakeVault();
  const clock = new FakeClock();
  const ledger = new EchoLedger(clock, 5000);
  const source = new EventSource(vault, clock, ledger, DEBOUNCE_MS);
  return { vault, clock, ledger, source };
}

/** let the async flush (echo probes are awaits) drain after advancing */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("EventSource — debounce batching", () => {
  it("waits for the window to close, merging same-path events", async () => {
    const { vault, clock, source } = setup();
    const batches: unknown[][] = [];
    source.start((events) => {
      batches.push(events);
    });

    vault.write("A/01.md", "one\n"); // emits create
    vault.write("A/01.md", "two\n"); // emits modify → collapses into create
    clock.advance(DEBOUNCE_MS + 1);
    await settle();

    expect(batches.length).toBe(1);
    expect(batches[0]).toEqual([{ type: "create", path: "A/01.md" }]);
    source.stop();
  });

  it("restarts the window on new events but never exceeds max-wait", async () => {
    const { vault, clock, source } = setup();
    const batches: unknown[][] = [];
    source.start((events) => {
      batches.push(events);
    });

    vault.write("A/01.md", "x\n");
    for (let i = 0; i < 6; i++) {
      clock.advance(DEBOUNCE_MS / 2);
      vault.write(`A/${i}.md`, "x\n");
    }
    clock.flush();
    await settle();

    expect(batches.length).toBe(1);
    expect(batches[0]?.length).toBe(7);
    source.stop();
  });
});

describe("EventSource — echo suppression", () => {
  it("drops the plugin's own writes (modify after ledger register)", async () => {
    const { vault, clock, ledger, source } = setup();
    const batches: unknown[][] = [];
    source.start((events) => {
      batches.push(events);
    });

    vault.seed("A/01.md", "---\norder: 10000\n---\n");
    // the writer path: register expected content, then process
    ledger.register("A/01.md", "---\norder: 20000\n---\n");
    await vault.process("A/01.md", () => "---\norder: 20000\n---\n");
    clock.advance(DEBOUNCE_MS + 1);
    await settle();

    expect(batches.length).toBe(0);
    source.stop();
  });

  it("drops the plugin's own deletes via the absent ledger", async () => {
    const { vault, clock, ledger, source } = setup();
    const batches: unknown[][] = [];
    source.start((events) => {
      batches.push(events);
    });

    vault.seed("A/01.md", "x\n");
    ledger.registerAbsent("A/01.md");
    await vault.trashFile("A/01.md");
    clock.advance(DEBOUNCE_MS + 1);
    await settle();

    expect(batches.length).toBe(0);
    source.stop();
  });

  it("keeps user edits that differ from the registered echo", async () => {
    const { vault, clock, ledger, source } = setup();
    const batches: unknown[][] = [];
    source.start((events) => {
      batches.push(events);
    });

    vault.seed("A/01.md", "---\norder: 10000\n---\n");
    ledger.register("A/01.md", "---\norder: 20000\n---\n");
    // the user changes the file further before the window closes
    vault.write("A/01.md", "---\norder: 30000\n---\n");
    clock.advance(DEBOUNCE_MS + 1);
    await settle();

    expect(batches.length).toBe(1);
    source.stop();
  });
});
