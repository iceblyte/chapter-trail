/**
 * PanelRoot — the management panel (MVP core UI, prototype 01).
 * VaultSummary on top, the legacy-order banner, one card per managed
 * domain, and the start-managing entry at the bottom.
 */
import { useMemo, useState } from "react";
import type { RegistryStore } from "../adapter/registry-store";
import type { I18nService } from "../i18n/runtime";
import type { ChapterTrailSettings } from "../settings";
import type { ManagedDomain, Registry } from "../types";
import { useI18n, useRegistry } from "./bridge";
import { AddDomainFlow } from "./components/AddDomainFlow";
import { DomainCard } from "./components/DomainCard";
import type { PanelActions } from "./panel-actions";

export interface PanelRootProps {
  store: RegistryStore;
  i18n: I18nService;
  settings: ChapterTrailSettings;
  actions: PanelActions;
}

export function PanelRoot(props: PanelRootProps): React.JSX.Element {
  const registry: Registry = useRegistry(props.store);
  const { t } = useI18n(props.i18n);
  const [flowOpen, setFlowOpen] = useState(false);

  const domains = useMemo(() => [...registry.domains.values()], [registry]);
  const attention = domains.filter((domain) => hasChips(domain)).length;
  const legacyTotal = useMemo(
    () => [...registry.legacyOrders.values()].reduce((sum, paths) => sum + paths.length, 0),
    [registry.legacyOrders],
  );
  const legacyDomain = registry.legacyOrders.keys().next().value;

  return (
    <div className="ct-panel">
      <div className="ct-panel-head">
        <span className="ct-panel-title">{t("Chapter Trail")}</span>
        <button
          type="button"
          className="ct-icon-btn"
          title={t("Re-scan vault")}
          onClick={() => void props.actions.rescan()}
        >
          ⟳
        </button>
        <button
          type="button"
          className="ct-icon-btn"
          title={t("Settings")}
          onClick={() => props.actions.openSettings()}
        >
          ⚙
        </button>
      </div>

      <div className="ct-summary">
        <span>
          {`${t(domains.length === 1 ? "{n} domain" : "{n} domains", { n: domains.length })} · ${t(attention === 1 ? "{m} needs attention" : "{m} need attention", { m: attention })}`}
        </span>
        <span className="ct-legend">
          <i>
            <span className="ct-dot is-red" />
            {t("red")}
          </i>
          <i>
            <span className="ct-dot is-yellow" />
            {t("yellow")}
          </i>
          <i>
            <span className="ct-dot is-blue" />
            {t("blue")}
          </i>
        </span>
      </div>

      {legacyTotal > 0 && legacyDomain !== undefined && (
        <div className="ct-banner">
          <span className="ct-dot is-yellow" />
          <span
            // eslint-disable-next-line react/no-danger -- i18n copy carries <code>
            dangerouslySetInnerHTML={{
              __html: t("{n} legacy <code>order</code> fields — “{domain}” was dissolved", {
                n: legacyTotal,
                domain: legacyDomain,
              }),
            }}
          />
          <button
            type="button"
            className="ct-btn"
            onClick={() => props.actions.reviewLegacyOrders(legacyDomain)}
          >
            {t("Review")}
          </button>
        </div>
      )}

      <div className="ct-panel-body">
        {domains.map((domain) => (
          <DomainCard
            key={domain.root}
            domain={domain}
            settings={props.settings}
            actions={props.actions}
            i18n={props.i18n}
          />
        ))}
        {domains.length === 0 && <div className="ct-empty-note">{t("Not available yet")}</div>}
      </div>

      <div className="ct-panel-foot">
        <button type="button" className="ct-btn is-accent" onClick={() => setFlowOpen(true)}>
          {t("＋ Start managing a folder")}
        </button>
        {flowOpen && (
          <AddDomainFlow
            actions={props.actions}
            i18n={props.i18n}
            onClose={() => setFlowOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function hasChips(domain: ManagedDomain): boolean {
  const status = domain.status;
  return (
    status.broken.length > 0 ||
    status.conflicts.length > 0 ||
    status.pending.length > 0 ||
    status.stale ||
    status.ties.length > 0 ||
    status.tightGap ||
    status.legacyHint
  );
}
