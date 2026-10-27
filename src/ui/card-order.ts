/** pure: order domain cards by the persisted drag order, with a
 *  deterministic alphabetical fallback — the registry's Map insertion
 *  order changes across scans (file renames resort the file list), so
 *  relying on it made cards jump between renders. */
import type { ManagedDomain } from "../types";

// deterministic across environments: plain code-unit comparison
const byRootPath = (a: ManagedDomain, b: ManagedDomain): number =>
  a.root < b.root ? -1 : a.root > b.root ? 1 : 0;

export function orderedDomains(
  domains: readonly ManagedDomain[],
  cardOrder: readonly string[],
): ManagedDomain[] {
  const byRoot = new Map(domains.map((domain) => [domain.root, domain]));
  const ordered: ManagedDomain[] = [];
  const rest: ManagedDomain[] = [];
  for (const root of cardOrder) {
    const domain = byRoot.get(root);
    if (domain) {
      ordered.push(domain);
      byRoot.delete(root);
    }
  }
  for (const domain of byRoot.values()) rest.push(domain);
  rest.sort(byRootPath);
  return [...ordered, ...rest];
}
