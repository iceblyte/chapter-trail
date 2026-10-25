/**
 * Order math and chain sorting (DESIGN.md §4.3 / §5.1).
 * Pure functions only — the A6/A9 implementation core.
 */
import { GAP_THRESHOLD, STEP } from "../constants";
import type { OrderEntry, VaultPath } from "../types";

const basenameCollator = new Intl.Collator("zh", { numeric: true });

/** Whitelist an order value: positive safe integer, anything else is
 *  treated as missing (DESIGN.md R11). */
export function orderValue(raw: unknown): number | undefined {
  if (
    typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw > 0 &&
    raw <= Number.MAX_SAFE_INTEGER
  ) {
    return raw;
  }
  return undefined;
}

export function basename(path: VaultPath): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

export interface SortOutcome {
  sorted: OrderEntry[];
  /** paths taking part in an order collision (yellow ties) */
  ties: VaultPath[];
  /** chain members without a valid order (blue pending) */
  pending: VaultPath[];
}

function compareByFilename(a: OrderEntry, b: OrderEntry): number {
  return basenameCollator.compare(basename(a.path), basename(b.path));
}

/**
 * Sort chain members: order ascending, filename natural order as the tie
 * breaker; members without order go last (filename order) and are
 * reported as pending.
 */
export function sortChain(entries: OrderEntry[]): SortOutcome {
  const withOrder: OrderEntry[] = [];
  const withoutOrder: OrderEntry[] = [];
  for (const entry of entries) {
    if (entry.order === undefined) withoutOrder.push(entry);
    else withOrder.push(entry);
  }

  withOrder.sort((a, b) => {
    const byOrder = (a.order ?? 0) - (b.order ?? 0);
    return byOrder !== 0 ? byOrder : compareByFilename(a, b);
  });
  withoutOrder.sort(compareByFilename);

  const ties = new Set<VaultPath>();
  for (let i = 1; i < withOrder.length; i++) {
    const prev = withOrder[i - 1];
    const current = withOrder[i];
    if (prev && current && prev.order === current.order) {
      ties.add(prev.path);
      ties.add(current.path);
    }
  }

  return {
    sorted: [...withOrder, ...withoutOrder],
    ties: [...ties],
    pending: withoutOrder.map((entry) => entry.path),
  };
}

/** ⌊(prev + next) / 2⌋ — the only file written by an everyday insert. */
export function midpointOrder(prev: number, next: number): number {
  return Math.floor((prev + next) / 2);
}

/** Tail append value; null signals overflow → caller must normalize. */
export function tailOrder(maxOrder: number): number | null {
  const next = maxOrder + STEP;
  return next <= Number.MAX_SAFE_INTEGER - STEP ? next : null;
}

/** Reindex: 10000, 20000, 30000… preserving chain sequence. */
export function normalizedOrder(index: number): number {
  return (index + 1) * STEP;
}

/** Any adjacent gap between consecutive orders below the threshold? */
export function detectTightGaps(sortedOrders: number[]): boolean {
  for (let i = 1; i < sortedOrders.length; i++) {
    const prev = sortedOrders[i - 1];
    const current = sortedOrders[i];
    if (prev !== undefined && current !== undefined && current - prev < GAP_THRESHOLD) {
      return true;
    }
  }
  return false;
}

export interface InsertPlan {
  /** orders that must be written, keyed by vault path */
  writes: Map<VaultPath, number>;
  /** true when a whole-domain normalize preceded the midpoint */
  normalized: boolean;
}

/**
 * Compute the order writes for moving `entryPath` to sit at
 * `targetIndex` within the current chain (DESIGN.md §4.3):
 *
 * 1. simulate the new chain sequence;
 * 2. if the landing gap is too tight (<10), normalize the whole domain
 *    first — the midpoint is always computed on normalized values;
 * 3. otherwise only the moved entry is written (midpoint or tail append).
 */
export function planInsert(
  chain: OrderEntry[],
  entryPath: VaultPath,
  targetIndex: number,
): InsertPlan {
  const moving = chain.find((entry) => entry.path === entryPath);
  if (!moving) return { writes: new Map(), normalized: false };

  const rest = chain.filter((entry) => entry.path !== entryPath);
  const clamped = Math.max(0, Math.min(targetIndex, rest.length));
  const simulated = [...rest.slice(0, clamped), moving, ...rest.slice(clamped)];

  // dragging an ordered entry back to its own slot writes nothing
  const originalIndex = chain.findIndex((entry) => entry.path === entryPath);
  if (originalIndex === clamped && moving.order !== undefined) {
    return { writes: new Map(), normalized: false };
  }

  const orders = simulated.map((entry) => entry.order);
  const allOrdered = orders.every((order) => order !== undefined);

  if (allOrdered) {
    const prevOrder = clamped > 0 ? simulated[clamped - 1]?.order : undefined;
    const nextOrder = clamped < simulated.length - 1 ? simulated[clamped + 1]?.order : undefined;

    if (
      prevOrder !== undefined &&
      nextOrder !== undefined &&
      nextOrder - prevOrder < GAP_THRESHOLD
    ) {
      // tight landing gap → normalize first, midpoint on new values
      return { writes: normalizeWrites(simulated, clamped), normalized: true };
    }

    if (prevOrder !== undefined && nextOrder !== undefined) {
      return {
        writes: new Map([[entryPath, midpointOrder(prevOrder, nextOrder)]]),
        normalized: false,
      };
    }
    if (prevOrder !== undefined) {
      const appended = tailOrder(prevOrder);
      if (appended !== null) {
        return { writes: new Map([[entryPath, appended]]), normalized: false };
      }
      return { writes: normalizeWrites(simulated, clamped), normalized: true };
    }
    if (nextOrder !== undefined) {
      // moving to the head: first order minus a step (fallback midpoint 0→next)
      const head = nextOrder - STEP;
      if (head > 0) return { writes: new Map([[entryPath, head]]), normalized: false };
      return {
        writes: new Map([[entryPath, Math.floor(nextOrder / 2)]]),
        normalized: false,
      };
    }
  }

  // chain of one or neighbors without order: plain normalize is the
  // safest deterministic placement
  return { writes: normalizeWrites(simulated, clamped), normalized: true };
}

function normalizeWrites(simulated: OrderEntry[], landingIndex: number): Map<VaultPath, number> {
  const writes = new Map<VaultPath, number>();
  simulated.forEach((entry, index) => {
    const target = normalizedOrder(index);
    if (entry.order !== target) writes.set(entry.path, target);
  });
  // the moving entry keeps its normalized slot after the rewrite
  const landing = simulated[landingIndex];
  if (landing) writes.set(landing.path, normalizedOrder(landingIndex));
  return writes;
}
