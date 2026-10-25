/**
 * EntryList — the virtualized, drag-reorderable chain list
 * (prototype 01/03). @tanstack/react-virtual keeps 500-entry domains
 * smooth; pragmatic-drag-and-drop binds only to rendered rows; the
 * right-click menu (Move up / Move down) is the keyboard fallback.
 */

import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import {
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { ROW_HEIGHT } from "../../constants";
import type { I18nService } from "../../i18n/runtime";
import type { ChapterTrailSettings } from "../../settings";
import type { ManagedDomain, OrderEntry } from "../../types";
import { useI18n } from "../bridge";
import type { PanelActions } from "../panel-actions";

const DRAG_TYPE = "ct-entry";

interface DragData {
  type: typeof DRAG_TYPE;
  domainRoot: string;
  entryPath: string;
}

export interface EntryListProps {
  domain: ManagedDomain;
  settings: ChapterTrailSettings;
  actions: PanelActions;
  i18n: I18nService;
}

export function EntryList(props: EntryListProps): React.JSX.Element {
  const { domain, actions } = props;
  const { t } = useI18n(props.i18n);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const view = useMemo(() => {
    const pending = domain.entries.filter((entry) => entry.order === undefined);
    const ordered = domain.entries.filter((entry) => entry.order !== undefined);
    const shown: OrderEntry[] = [...ordered, ...pending.slice(0, 3)];
    return { shown, morePending: Math.max(0, pending.length - 3) };
  }, [domain.entries]);

  const broken = domain.status.broken;
  const rowCount = view.shown.length + (view.morePending > 0 ? 1 : 0) + broken.length;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  /* card-level monitor: resolve drops into target indices */
  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => {
        const data = source.data as Partial<DragData>;
        return data.type === DRAG_TYPE && data.domainRoot === domain.root;
      },
      onDrop: ({ source, location }) => {
        setDragging(null);
        const data = source.data as Partial<DragData>;
        const target = location.current.dropTargets[0];
        if (!target) return;
        const targetIndex = (target.data as { index?: number }).index;
        if (targetIndex === undefined) return;
        const edge = extractClosestEdge(target.data);
        let insertAt = targetIndex + (edge === "bottom" ? 1 : 0);
        const from = domain.entries.findIndex((entry) => entry.path === data.entryPath);
        if (from === -1) return;
        if (insertAt > from) insertAt -= 1;
        if (insertAt === from) return;
        if (data.entryPath !== undefined)
          void actions.moveEntry(domain.root, data.entryPath, insertAt);
      },
    });
  }, [actions, domain.entries, domain.root]);

  /* auto-scroll the list container while dragging inside this domain */
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    return autoScrollForElements({
      element,
      canScroll: ({ source }) => {
        const data = source.data as Partial<DragData>;
        return data.type === DRAG_TYPE && data.domainRoot === domain.root;
      },
    });
  }, [domain.root]);

  const onMove = (entryPath: string, delta: -1 | 1): void => {
    const index = domain.entries.findIndex((entry) => entry.path === entryPath);
    if (index === -1) return;
    const target = index + delta;
    if (target < 0 || target >= domain.entries.length) return;
    void actions.moveEntry(domain.root, entryPath, target);
  };

  return (
    <div className="ct-rows">
      <div ref={scrollRef} className="ct-rows-scroll">
        <div style={{ position: "relative", height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const absoluteStyle = {
              position: "absolute" as const,
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            };
            const rowIndex = virtualRow.index;

            if (rowIndex >= view.shown.length) {
              /* trailing info rows: …more pending, then broken links */
              const trailing = rowIndex - view.shown.length;
              const brokenPath = broken[trailing - (view.morePending > 0 ? 1 : 0)];
              return (
                <div key={virtualRow.key} className="ct-row is-dim" style={absoluteStyle}>
                  {brokenPath ? (
                    <span className="ct-row-title is-missing">
                      {brokenPath} — {t("file not found — deleted or moved out of the vault")}
                    </span>
                  ) : (
                    <span className="ct-row-title">
                      {t(
                        "…{n} more · git sync batch — no auto-write, drag or use first-run assignment",
                        { n: view.morePending },
                      )}
                    </span>
                  )}
                </div>
              );
            }

            const entry = view.shown[rowIndex];
            if (!entry) return null;

            if (entry.order === undefined) {
              /* pending (blue) row */
              return (
                <div key={virtualRow.key} className="ct-row is-pending" style={absoluteStyle}>
                  <span className="ct-dot is-blue" style={{ marginRight: 1 }} />
                  <span className="ct-row-title">{entry.title}</span>
                  <span className="ct-row-date">—</span>
                  <span className="ct-row-order">—</span>
                </div>
              );
            }

            return (
              <ChainRow
                key={virtualRow.key}
                entry={entry}
                chainIndex={domain.entries.findIndex((e) => e.path === entry.path)}
                displayIndex={rowIndex}
                domainRoot={domain.root}
                isFolder={entry.kind === "managed-folder"}
                isDragging={dragging === entry.path}
                onDragState={setDragging}
                onMove={onMove}
                dateDisplay={props.settings.dateDisplay}
              />
            );
          })}
        </div>
      </div>
      <div className="ct-rows-foot">
        {t("{n} entries", { n: domain.entries.length })} · {t("virtualized list (32px rows)")}
      </div>
    </div>
  );
}

interface ChainRowProps {
  entry: OrderEntry;
  /** index within the full chain (numbering) */
  chainIndex: number;
  /** index within the rendered display list (drop target) */
  displayIndex: number;
  domainRoot: string;
  isFolder: boolean;
  isDragging: boolean;
  onDragState(path: string | null): void;
  onMove(path: string, delta: -1 | 1): void;
  dateDisplay: ChapterTrailSettings["dateDisplay"];
}

const ChainRow = (props: ChainRowProps): React.JSX.Element => {
  const { entry } = props;
  const rowRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLSpanElement>(null);
  const dragState = props.onDragState;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  /* the context menu closes on any outside click or Escape */
  useEffect(() => {
    if (!menu) return;
    const close = (): void => setMenu(null);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    const element = rowRef.current;
    const grip = gripRef.current;
    if (!element || !grip) return;
    return draggable({
      element,
      dragHandle: grip,
      getInitialData: (): Record<string, unknown> => ({
        type: DRAG_TYPE,
        domainRoot: props.domainRoot,
        entryPath: entry.path,
      }),
      onDragStart: () => dragState(entry.path),
      onDrop: () => dragState(null),
    });
  }, [entry.path, props.domainRoot, dragState]);

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const data = source.data as Partial<DragData>;
        return data.type === DRAG_TYPE && data.domainRoot === props.domainRoot;
      },
      getData: ({ element, input }) =>
        attachClosestEdge(
          { index: props.displayIndex },
          {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          },
        ),
    });
  }, [props.displayIndex, props.domainRoot]);

  const date = formatDate(entry, props.dateDisplay);

  return (
    <div
      ref={rowRef}
      className={`ct-row${props.isDragging ? " is-lifted" : ""}${props.isFolder ? " is-managedfolder" : ""}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: `${ROW_HEIGHT}px`,
        transform: `translateY(${props.displayIndex * ROW_HEIGHT}px)`,
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <span className="ct-grip" ref={gripRef}>
        ⠿
      </span>
      <span className={`ct-row-title${props.isFolder ? " is-folder" : ""}`}>
        <span className="ct-seq">{String(props.chainIndex + 1).padStart(2, "0")}</span>
        {entry.prefix !== undefined && <span className="ct-prefix">{entry.prefix}</span>}
        {entry.title}
      </span>
      <span className="ct-row-date">{date ?? "—"}</span>
      <span className="ct-row-order">{entry.order ?? "—"}</span>
      {menu && (
        <div
          className="ct-menu is-open ct-ctx-menu"
          style={{ top: `${menu.y}px`, left: `${menu.x}px` }}
        >
          <div
            className="ct-menu-item"
            onClick={() => {
              setMenu(null);
              props.onMove(entry.path, -1);
            }}
          >
            ⬆ Move up
          </div>
          <div
            className="ct-menu-item"
            onClick={() => {
              setMenu(null);
              props.onMove(entry.path, 1);
            }}
          >
            ⬇ Move down
          </div>
        </div>
      )}
    </div>
  );
};

function formatDate(entry: OrderEntry, mode: ChapterTrailSettings["dateDisplay"]): string | null {
  const dates = entry.dates;
  if (!dates) return null;
  if (mode === "created") return dates.created ?? null;
  if (mode === "updated") return dates.updated ?? null;
  const parts = [dates.created, dates.updated].filter((part): part is string => part !== undefined);
  return parts.length === 2 ? parts.join(" → ") : (parts[0] ?? null);
}
