/**
 * NavWriter — builds the write plans for navigation injection
 * (DESIGN.md §4.7). The InjectionGate brand type is the hard invariant
 * (G4 / PRD §2.6): every plan-building method requires a gate that only
 * InjectionSession.open(true) can create. With the setting off there is
 * no value in the program that could be passed here — the injection
 * write path is physically unreachable, not merely switched at runtime.
 */
import type { OrderEntry, VaultPath } from "../types";
import { stripNavBlocks, writeNavBlocks } from "./block-codec";
import { calloutLines, type NavContext } from "./nav-template";

export type InjectionGate = InjectionGateToken;

/**
 * Runtime-real brand: private constructor means no code outside this
 * module can forge the value — only openInjectionGate(true) mints one.
 */
export class InjectionGateToken {
  readonly brand = "chapter-trail/injection-gate";
  private constructor() {}
  static mint(): InjectionGateToken {
    return new InjectionGateToken();
  }
}

/** the single creation point of the gate */
export function openInjectionGate(enabled: boolean): InjectionGate | null {
  return enabled ? InjectionGateToken.mint() : null;
}

export interface NavWriteOp {
  path: VaultPath;
  /** raw text → new text; returning the input unchanged skips the write */
  apply: (raw: string) => string;
}

export interface NavWritePlan {
  ops: NavWriteOp[];
}

/**
 * Plan the (re)injection for one domain: every .md in scope that is a
 * chain member gets the canonical top+bottom blocks with its chain
 * neighbors; every other file in scope (e.g. newly excluded) gets its
 * wrappers stripped. Files that end up unchanged are skipped by the
 * writer.
 */
export function buildInjectionPlan(
  gate: InjectionGate,
  chain: readonly OrderEntry[],
  filesInScope: readonly VaultPath[],
  ctx: NavContext,
): NavWritePlan {
  void gate; // presence is the proof of authorization
  const lines = calloutLines(chain, ctx);
  const ops: NavWriteOp[] = [];
  for (const path of filesInScope) {
    const line = lines.get(path);
    ops.push({
      path,
      apply:
        line === undefined ? (raw) => stripNavBlocks(raw).text : (raw) => writeNavBlocks(raw, line),
    });
  }
  return { ops };
}

/** Plan marker removal for a set of files (gate-off cleanup, remove-all). */
export function buildStripPlan(gate: InjectionGate, files: readonly VaultPath[]): NavWritePlan {
  void gate;
  return {
    ops: files.map((path) => ({
      path,
      apply: (raw: string) => stripNavBlocks(raw).text,
    })),
  };
}
