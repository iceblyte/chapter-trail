/**
 * EntryList — the domain card's entry list (prototype 01/03).
 *
 * Display forms:
 * - series: a collapsible tree — subfolder nodes (default collapsed)
 *   interleave by chain order; files drag onto rows to reorder.
 * - independent: the flat mixed list (direct files + managed folders,
 *   unmanaged folders trailing as plain rows).
 *
 * Every draggable row carries the SAME payload shape (type "ct-entry"
 * + entryPath), which is the pipeline verifiably working end to end;
 * folder rows additionally carry a folderPath marker so the monitor
 * routes the drop to a whole-block move (moveFolder).
 * The domain's index page is pinned above the list (display only).
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
import { setIcon } from "obsidian";
import { useEffect, useMemo, useRef, useState } from "react";
import { ROW_HEIGHT } from "../../constants";
import { parentOf } from "../../core/path-util";
import type { I18nService } from "../../i18n/runtime";
import type { ChapterTrailSettings } from "../../settings";
import type { ManagedDomain, OrderEntry } from "../../types";
import { useI18n } from "../bridge";
import type { PanelActions } from "../panel-actions";

const DRAG_TYPE = "ct-entry";

/** per-domain list scroll positions, preserved across remounts */
const scrollMemory = new Map<string, number>();

interface DragData {
  type: typeof DRAG_TYPE;
  domainRoot: string;
  entryPath: string;
  /** present when the drag started on a series folder row */
  folderPath?: string | undefined;
}

type Row =
  | {
      kind: "folder";
      path: string;
      name: string;
      depth: number;
      chainIndex: number;
      firstFilePath: string;
    }
  | { kind: "file"; entry: OrderEntry; chainIndex: number; depth: number }
  | { kind: "pending"; entry: OrderEntry }
  | { kind: "unmanaged"; path: string; name: string }
  | { kind: "more"; count: number }
  | { kind: "broken"; path: string };

export interface EntryListProps {
  domain: ManagedDomain;
  settings: ChapterTrailSettings;
  actions: PanelActions;
  i18n: I18nService;
  expandedFolders: ReadonlySet<string>;
  onToggleFolder(path: string): void;
}

/** build the series tree from the ordered chain, first-appearance order */
function buildSeriesRows(
  ordered: OrderEntry[],
  expanded: ReadonlySet<string>,
  domainRoot: string,
): Row[] {
  interface TreeNode {
    folders: Map<string, TreeNode>;
    files: { entry: OrderEntry; chainIndex: number }[];
  }
  const root: TreeNode = { folders: new Map(), files: [] };
  ordered.forEach((entry, chainIndex) => {
    // paths are relative to the domain root — the root itself is the
    // card, not a tree node
    const rel = domainRoot === "" ? entry.path : entry.path.slice(domainRoot.length + 1);
    const segments = rel.split("/");
    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const folderPath = segments.slice(0, i + 1).join("/");
      let child = node.folders.get(folderPath);
      if (!child) {
        child = { folders: new Map(), files: [] };
        node.folders.set(folderPath, child);
      }
      node = child;
    }
    node.files.push({ entry, chainIndex });
  });

  const rows: Row[] = [];
  const subtreeFirstIndex = (node: TreeNode): number => {
    let min = Number.MAX_SAFE_INTEGER;
    for (const file of node.files) min = Math.min(min, file.chainIndex);
    for (const child of node.folders.values()) {
      min = Math.min(min, subtreeFirstIndex(child));
    }
    return min;
  };
  const emit = (node: TreeNode, depth: number, parentPrefix: string): void => {
    // children in FIRST-APPEARANCE order — identical to the core flatten,
    // so the panel tree, the native explorer and the chain agree
    const children: {
      kind: "folder" | "file";
      relPath: string;
      child?: TreeNode;
      file?: { entry: OrderEntry; chainIndex: number };
      firstIndex: number;
    }[] = [];
    for (const [relPath, child] of node.folders) {
      children.push({
        kind: "folder",
        relPath,
        child,
        firstIndex: subtreeFirstIndex(child),
      });
    }
    for (const file of node.files) {
      children.push({ kind: "file", relPath: "", file, firstIndex: file.chainIndex });
    }
    children.sort((a, b) => a.firstIndex - b.firstIndex);
    for (const child of children) {
      if (child.kind === "folder") {
        const relPath = child.relPath;
        const node2 = child.child;
        if (!node2) continue;
        const folderPath = parentPrefix === "" ? relPath : `${parentPrefix}/${relPath}`;
        const first = node2.files[0] ?? [...node2.folders.values()].flatMap((f) => f.files)[0];
        rows.push({
          kind: "folder",
          path: folderPath,
          name: relPath,
          depth,
          chainIndex: first?.chainIndex ?? ordered.length,
          firstFilePath: first?.entry.path ?? "",
        });
        if (expanded.has(folderPath)) emit(node2, depth + 1, folderPath);
        continue;
      }
      const file = child.file;
      if (!file) continue;
      rows.push({ kind: "file", entry: file.entry, chainIndex: file.chainIndex, depth });
    }
  };
  emit(root, 0, domainRoot);
  return rows;
}

export function EntryList(props: EntryListProps): React.JSX.Element {
  const { domain, actions } = props;
  const { t } = useI18n(props.i18n);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  /* preserve the list scroll position across registryVersion remounts —
   * without this the card list jumps back to its first rows after any
   * scan-triggered re-render */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = scrollMemory.get(domain.root);
    if (saved !== undefined) el.scrollTop = saved;
    const save = (): void => {
      scrollMemory.set(domain.root, el.scrollTop);
    };
    el.addEventListener("scroll", save);
    return () => {
      el.removeEventListener("scroll", save);
      scrollMemory.set(domain.root, el.scrollTop);
    };
  }, [domain.root]);

  const view = useMemo(() => {
    const pending = domain.entries.filter((entry) => entry.order === undefined);
    const ordered = domain.entries.filter((entry) => entry.order !== undefined);
    let rows: Row[];
    if (domain.mode === "series") {
      rows = buildSeriesRows(ordered, props.expandedFolders, domain.root);
    } else {
      rows = ordered.map((entry, chainIndex) => ({
        kind: "file" as const,
        entry,
        chainIndex,
        depth: 0,
      }));
      // unmanaged subfolders trail (plain rows, not draggable)
      for (const folder of domain.unmanagedFolders) {
        rows.push({ kind: "unmanaged", path: folder.path, name: folder.title });
      }
    }
    const shownPending = pending.slice(0, 3);
    return {
      rows,
      pending,
      shownPending,
      morePending: Math.max(0, pending.length - 3),
    };
  }, [domain.entries, domain.mode, domain.root, domain.unmanagedFolders, props.expandedFolders]);

  const broken = domain.status.broken;
  const rowCount =
    view.rows.length + view.shownPending.length + (view.morePending > 0 ? 1 : 0) + broken.length;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  /* card-level monitor: drops carry the CHAIN index directly */
  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => {
        const data = source.data as Partial<DragData>;
        return data.type === DRAG_TYPE && data.domainRoot === domain.root;
      },
      onDrop: ({ source, location }) => {
        setDragging(null);
        try {
          const data = source.data as Partial<DragData>;
          const target = location.current.dropTargets[0];
          if (!target) return;
          const targetData = target.data as {
            chainIndex?: number;
            targetPath?: string;
            targetIsFolder?: boolean;
          };
          const edge = extractClosestEdge(target.data);
          const targetEdge: "top" | "bottom" = edge === "bottom" ? "bottom" : "top";
          // a folderPath marker means the drag started on a folder row:
          // block-move the whole subfolder relative to the drop target
          if (data.folderPath !== undefined && data.entryPath !== undefined) {
            const folderPath = data.folderPath !== "" ? data.folderPath : parentOf(data.entryPath);
            if (folderPath !== null && folderPath !== "" && targetData.targetPath) {
              void actions.moveFolder(domain.root, folderPath, {
                path: targetData.targetPath,
                isFolder: targetData.targetIsFolder === true,
                edge: targetEdge,
              });
              return;
            }
          }
          const chainIndex = targetData.chainIndex;
          if (chainIndex === undefined) return;
          const landing = chainIndex + (targetEdge === "bottom" ? 1 : 0);
          // dropping a file onto a row in a DIFFERENT folder physically
          // moves the file into that folder (drag to the outside) —
          // covers both folder rows and file rows across folders
          if (data.entryPath !== undefined && targetData.targetPath !== undefined) {
            const fileFolder = parentOf(data.entryPath);
            const targetFolder =
              targetData.targetIsFolder === true
                ? targetData.targetPath
                : parentOf(targetData.targetPath);
            if (fileFolder !== null && targetFolder !== null && fileFolder !== targetFolder) {
              void actions.moveFileToFolder(domain.root, data.entryPath, targetFolder);
              return;
            }
          }
          if (data.entryPath === undefined) return;
          let insertAt = landing;
          const from = domain.entries.findIndex((entry) => entry.path === data.entryPath);
          if (from === -1) return;
          if (insertAt > from) insertAt -= 1;
          if (insertAt === from) return;
          void actions.moveEntry(domain.root, data.entryPath, insertAt);
        } catch (error) {
          console.error("[chapter-trail] drag reorder failed", error);
        }
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

  const toggleFolder = (path: string): void => {
    props.onToggleFolder(path);
  };

  return (
    <div className="ct-rows">
      <button
        type="button"
        className="ct-row ct-index-row"
        onClick={() => actions.openIndexPage(domain.indexPath)}
        title={t("Open index page")}
      >
        <span className="ct-row-title">
          <span className="ct-seq">☰</span>
          {domain.indexPath.slice(domain.indexPath.lastIndexOf("/") + 1)}
        </span>
        <span className="ct-moc-badge">MOC</span>
      </button>
      <div className="ct-row ct-head-row" aria-hidden="true">
        <span className="ct-grip" style={{ visibility: "hidden" }} />
        <span className="ct-row-title">{t("File name")}</span>
        <span className="ct-row-date ct-col-created">{t("Created")}</span>
        <span className="ct-row-date ct-col-updated">{t("Updated")}</span>
        <span className="ct-row-order">{t("Order")}</span>
      </div>
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
            const trailStart = view.rows.length + view.shownPending.length;
            if (rowIndex >= trailStart) {
              const trailing = rowIndex - trailStart;
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
            const pendingIndex = rowIndex - view.rows.length;
            if (pendingIndex >= 0) {
              const entry = view.shownPending[pendingIndex];
              if (!entry) return null;
              return (
                <div key={virtualRow.key} className="ct-row is-pending" style={absoluteStyle}>
                  <span className="ct-dot is-blue" style={{ marginRight: 1 }} />
                  <span className="ct-row-title">{entry.title}</span>
                  <span className="ct-row-date">—</span>
                  <span className="ct-row-date">—</span>
                  <span className="ct-row-order">—</span>
                </div>
              );
            }

            const row = view.rows[rowIndex];
            if (!row) return null;
            if (row.kind === "folder") {
              return (
                <FolderRow
                  key={virtualRow.key}
                  path={row.path}
                  name={row.name}
                  depth={row.depth}
                  chainIndex={row.chainIndex}
                  firstFilePath={row.firstFilePath}
                  isOpen={props.expandedFolders.has(row.path)}
                  domainRoot={domain.root}
                  isDragging={dragging === row.firstFilePath}
                  onDragState={setDragging}
                  onToggle={toggleFolder}
                  style={absoluteStyle}
                />
              );
            }
            if (row.kind === "unmanaged") {
              return (
                <button
                  key={virtualRow.key}
                  type="button"
                  className="ct-row is-dim ct-unmanaged-row"
                  style={absoluteStyle}
                  title={t("Click to start managing this folder")}
                  onClick={() => void props.actions.startManagingWithModePicker(row.path)}
                >
                  <span className="ct-row-title is-folder" style={{ paddingLeft: 14 }}>
                    {row.name}
                  </span>
                  <span className="ct-row-date">—</span>
                  <span className="ct-row-date">—</span>
                  <span className="ct-row-order">—</span>
                </button>
              );
            }
            if (row.kind !== "file") return null;
            return (
              <ChainRow
                key={virtualRow.key}
                entry={row.entry}
                chainIndex={row.chainIndex}
                depth={row.depth}
                domainRoot={domain.root}
                isFolder={row.entry.kind === "managed-folder"}
                isDragging={dragging === row.entry.path}
                onDragState={setDragging}
                onMove={onMove}
                onOpen={props.actions.openFile}
                style={absoluteStyle}
                i18n={props.i18n}
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

interface FolderRowProps {
  path: string;
  name: string;
  depth: number;
  chainIndex: number;
  firstFilePath: string;
  isOpen: boolean;
  domainRoot: string;
  isDragging: boolean;
  onDragState(path: string | null): void;
  onToggle(path: string): void;
  style: React.CSSProperties;
}

/** series folder node: lucide folder icon, whole-row click toggles the
 *  children; dragging block-moves the folder (payload = first file plus
 *  a folderPath marker). */
const FolderRow = (props: FolderRowProps): React.JSX.Element => {
  const rowRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const dragState = props.onDragState;

  useEffect(() => {
    if (!iconRef.current) return;
    setIcon(iconRef.current, props.isOpen ? "folder-open" : "folder");
  }, [props.isOpen]);

  useEffect(() => {
    const element = rowRef.current;
    const grip = gripRef.current;
    if (!element || !grip || props.firstFilePath === "") return;
    return draggable({
      element,
      dragHandle: grip,
      getInitialData: (): Record<string, unknown> => ({
        type: DRAG_TYPE,
        domainRoot: props.domainRoot,
        entryPath: props.firstFilePath,
        folderPath: props.path,
      }),
      onDragStart: () => dragState(props.firstFilePath),
      onDrop: () => dragState(null),
    });
  }, [props.domainRoot, props.path, props.firstFilePath, dragState]);

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const data = source.data as Partial<DragData>;
        return data.type === DRAG_TYPE && data.domainRoot === props.domainRoot;
      },
      getData: ({ element: el, input }) =>
        attachClosestEdge(
          {
            chainIndex: props.chainIndex,
            targetPath: props.path,
            targetIsFolder: true,
          },
          { element: el, input, allowedEdges: ["top", "bottom"] },
        ),
    });
  }, [props.chainIndex, props.domainRoot, props.path]);

  return (
    <div
      ref={rowRef}
      className={`ct-row is-folder-row${props.isDragging ? " is-lifted" : ""}`}
      style={props.style}
      onClick={() => props.onToggle(props.path)}
    >
      <span className="ct-grip" ref={gripRef}>
        ⠿
      </span>
      <span className="ct-folder-icon" ref={iconRef} />
      <span
        className="ct-row-title is-folder"
        style={props.depth > 0 ? { paddingLeft: props.depth * 14 } : undefined}
      >
        {props.name}
      </span>
      <span className="ct-row-date">—</span>
      <span className="ct-row-date">—</span>
      <span className="ct-row-order">—</span>
    </div>
  );
};

interface ChainRowProps {
  entry: OrderEntry;
  chainIndex: number;
  depth: number;
  domainRoot: string;
  isFolder: boolean;
  isDragging: boolean;
  onDragState(path: string | null): void;
  onMove(path: string, delta: -1 | 1): void;
  onOpen(path: string): void;
  style: React.CSSProperties;
  i18n: I18nService;
}

const ChainRow = (props: ChainRowProps): React.JSX.Element => {
  const { entry } = props;
  const { t } = useI18n(props.i18n);
  const rowRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLSpanElement>(null);
  const folderIconRef = useRef<HTMLSpanElement>(null);
  const dragState = props.onDragState;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  /* managed-subfolder rows show the lucide folder icon */
  useEffect(() => {
    if (!folderIconRef.current) return;
    setIcon(folderIconRef.current, "folder");
  }, []);

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
      getData: ({ element: el, input }) =>
        attachClosestEdge(
          {
            chainIndex: props.chainIndex,
            targetPath: entry.path,
            targetIsFolder: false,
          },
          { element: el, input, allowedEdges: ["top", "bottom"] },
        ),
    });
  }, [props.chainIndex, props.domainRoot, entry.path]);

  return (
    <div
      ref={rowRef}
      className={`ct-row${props.isDragging ? " is-lifted" : ""}${props.isFolder ? " is-managedfolder" : ""}`}
      style={props.style}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <span className="ct-grip" ref={gripRef}>
        ⠿
      </span>
      {props.isFolder && <span className="ct-folder-icon" ref={folderIconRef} />}
      <span
        className={`ct-row-title${props.isFolder ? " is-folder" : ""}`}
        style={props.depth > 0 ? { paddingLeft: props.depth * 14 } : undefined}
        onClick={props.isFolder ? undefined : () => props.onOpen(entry.path)}
        title={props.isFolder ? undefined : entry.path}
      >
        <span className="ct-seq">{String(props.chainIndex + 1).padStart(2, "0")}</span>
        {entry.prefix !== undefined && props.isFolder === false && (
          <span className="ct-prefix">{entry.prefix}</span>
        )}
        {entry.title}
      </span>
      <span className="ct-row-date">{entry.dates?.created ?? "—"}</span>
      <span className="ct-row-date">{entry.dates?.updated ?? "—"}</span>
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
            ⬆ {t("Move up")}
          </div>
          <div
            className="ct-menu-item"
            onClick={() => {
              setMenu(null);
              props.onMove(entry.path, 1);
            }}
          >
            ⬇ {t("Move down")}
          </div>
        </div>
      )}
    </div>
  );
};
