/**
 * PanelRoot — the management panel (MVP core UI, prototype 01).
 * VaultSummary on top, the legacy-order banner, one card per managed
 * domain, and the start-managing entry at the bottom.
 */

import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { setIcon } from "obsidian";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RegistryStore } from "../adapter/registry-store";
import type { I18nService } from "../i18n/runtime";
import type { ChapterTrailSettings } from "../settings";
import type { ManagedDomain, Registry } from "../types";
import { useI18n, useRegistry } from "./bridge";
import { orderedDomains } from "./card-order";
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
  const [cardOrder, setCardOrder] = useState<readonly string[]>(
    () => props.settings.domainOrder ?? [],
  );
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  /** roots whose card body is folded; empty set = all expanded */
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  /** series tree expansion, lifted so EntryList remounts keep it */
  const [expandedFolders, setExpandedFolders] = useState<ReadonlySet<string>>(() => new Set());

  /* the start-managing command can open the picker remotely */
  useEffect(() => {
    const open = (): void => setFlowOpen(true);
    document.addEventListener("ct:open-start-flow", open);
    return () => document.removeEventListener("ct:open-start-flow", open);
  }, []);

  const domains = useMemo(() => [...registry.domains.values()], [registry]);
  const sortedDomains = useMemo(() => orderedDomains(domains, cardOrder), [domains, cardOrder]);
  const sortedRoots = useMemo(() => sortedDomains.map((domain) => domain.root), [sortedDomains]);
  const attention = domains.filter((domain) => hasChips(domain)).length;
  const legacyTotal = useMemo(
    () => [...registry.legacyOrders.values()].reduce((sum, paths) => sum + paths.length, 0),
    [registry.legacyOrders],
  );
  const legacyDomain = registry.legacyOrders.keys().next().value;

  /* single card monitor — resolves against the DISPLAYED root list
   * (the persisted cardOrder may be empty before the first drag) */
  const sortedRootsRef = useRef(sortedRoots);
  sortedRootsRef.current = sortedRoots;
  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => {
        const data = source.data as Partial<CardDragData>;
        return data.type === CARD_TYPE;
      },
      onDrop: ({ source, location }) => {
        try {
          const data = source.data as Partial<CardDragData>;
          if (data.domainRoot === undefined) return;
          const target = location.current.dropTargets[0];
          if (!target) return;
          const targetData = target.data as Partial<CardDragData>;
          if (targetData.domainRoot === undefined || targetData.domainRoot === data.domainRoot) {
            return;
          }
          const edge = extractClosestEdge(target.data);
          const current = [...sortedRootsRef.current];
          const from = current.indexOf(data.domainRoot);
          const to = current.indexOf(targetData.domainRoot);
          if (from === -1 || to === -1) return;
          current.splice(from, 1);
          let insertAt = to > from ? to - 1 : to;
          if (edge === "bottom") insertAt += 1;
          insertAt = Math.max(0, Math.min(insertAt, current.length));
          if (current[insertAt] === data.domainRoot) return;
          current.splice(insertAt, 0, data.domainRoot);
          setCardOrder(current);
          void props.actions.reorderDomains(current);
        } catch (error) {
          console.error("[chapter-trail] card reorder failed", error);
        }
      },
    });
  }, [props.actions]);

  const toggleCard = (root: string): void => {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(root)) next.delete(root);
      else next.add(root);
      return next;
    });
  };
  const toggleAllCards = (): void => {
    setFolded((current) => (current.size > 0 ? new Set() : new Set(domains.map((d) => d.root))));
  };

  return (
    <div className="ct-panel">
      <div className="ct-panel-head">
        <span className="ct-panel-title">{t("Chapter Trail")}</span>
        <button
          type="button"
          className="ct-icon-btn"
          title={t(folded.size > 0 ? "Expand all" : "Collapse all")}
          onClick={toggleAllCards}
        >
          <ObsidianIcon name={folded.size > 0 ? "chevrons-up-down" : "chevrons-down-up"} />
        </button>
        <button
          type="button"
          className="ct-icon-btn"
          title={t("Re-scan vault")}
          onClick={() => void props.actions.rescan()}
        >
          <ObsidianIcon name="refresh-cw" />
        </button>
        <button
          type="button"
          className="ct-icon-btn"
          title={t("Settings")}
          onClick={() => props.actions.openSettings()}
        >
          <ObsidianIcon name="settings" />
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
        {sortedDomains.map((domain) => (
          <SortableCard
            key={domain.root}
            domainRoot={domain.root}
            onDragState={setDraggingCard}
            dragging={draggingCard === domain.root}
          >
            <DomainCard
              domain={domain}
              settings={props.settings}
              actions={props.actions}
              i18n={props.i18n}
              open={!folded.has(domain.root)}
              onToggleOpen={() => toggleCard(domain.root)}
              expandedFolders={expandedFolders}
              onToggleFolder={(path) => {
                setExpandedFolders((current) => {
                  const next = new Set(current);
                  if (next.has(path)) next.delete(path);
                  else next.add(path);
                  return next;
                });
              }}
            />
          </SortableCard>
        ))}
        {domains.length === 0 && (
          <div className="ct-empty-note">
            {t("No managed folders yet — use the button below to start managing one")}
          </div>
        )}
      </div>

      <div className="ct-panel-foot">
        <button type="button" className="ct-btn is-accent" onClick={() => setFlowOpen(true)}>
          {t("＋ Start managing a folder")}
        </button>
      </div>

      {flowOpen && (
        <AddDomainFlow
          actions={props.actions}
          i18n={props.i18n}
          settings={props.settings}
          onClose={() => setFlowOpen(false)}
        />
      )}
    </div>
  );
}

/** lucide icon rendered through Obsidian's setIcon */
function ObsidianIcon(props: { name: string }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    setIcon(ref.current, props.name);
  }, [props.name]);
  return <span ref={ref} className="ct-ob-icon" />;
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

const CARD_TYPE = "ct-card";

interface CardDragData {
  type: typeof CARD_TYPE;
  domainRoot: string;
}

/**
 * Card drag: draggable/drop-target wrappers per card, but ONE monitor
 * at the panel level. The monitor resolves the new order against the
 * DISPLAYED root list (not the persisted cardOrder, which may be
 * empty on first use — that was the "drags but never swaps" bug).
 */
function SortableCard(props: {
  domainRoot: string;
  onDragState(root: string | null): void;
  dragging: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    const grip = gripRef.current;
    if (!element || !grip) return;
    return draggable({
      element,
      dragHandle: grip,
      getInitialData: (): Record<string, unknown> => ({
        type: CARD_TYPE,
        domainRoot: props.domainRoot,
      }),
      onDragStart: () => props.onDragState(props.domainRoot),
      onDrop: () => props.onDragState(null),
    });
  }, [props.domainRoot, props.onDragState]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const data = source.data as Partial<CardDragData>;
        return data.type === CARD_TYPE && data.domainRoot !== props.domainRoot;
      },
      getData: ({ element: el, input }) =>
        attachClosestEdge(
          { domainRoot: props.domainRoot },
          {
            element: el,
            input,
            allowedEdges: ["top", "bottom"],
          },
        ),
    });
  }, [props.domainRoot]);

  return (
    <div
      ref={ref}
      className={`ct-card-wrap${props.dragging ? " is-lifted" : ""}`}
      style={props.dragging ? { opacity: 0.4 } : undefined}
    >
      <div ref={gripRef} className="ct-card-grip" title="Drag to reorder">
        ⠿
      </div>
      {props.children}
    </div>
  );
}
