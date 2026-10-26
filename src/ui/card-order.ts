/** pure: order domain cards by the persisted drag order (new domains last) */
import type { ManagedDomain } from "../types";

export function orderedDomains(
  domains: readonly ManagedDomain[],
  cardOrder: readonly string[],
): ManagedDomain[] {
  if (cardOrder.length === 0) return [...domains];
  const originalIndex = new Map(domains.map((domain, index) => [domain.root, index]));
  return [...domains].sort((a, b) => {
    const ia = cardOrder.indexOf(a.root);
    const ib = cardOrder.indexOf(b.root);
    if (ia === -1 && ib === -1) {
      return (originalIndex.get(a.root) ?? 0) - (originalIndex.get(b.root) ?? 0);
    }
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
