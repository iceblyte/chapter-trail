/**
 * AddDomainFlow — the two-step start-managing flow (prototype 04):
 * pick a folder, then pick a mode with the consequences spelled out.
 * Rendered as an overlay inside the panel.
 *
 * Round 20: step 1 is a TREE — the vault's top-level folders are
 * multiple roots, each expandable one by one, so a big vault no longer
 * dumps a long flat list on the user. The filter auto-expands matches.
 */
import { setIcon } from "obsidian";
import { useEffect, useMemo, useRef, useState } from "react";
import type { I18nService } from "../../i18n/runtime";
import type { FolderTreeNode } from "../../services";
import type { DomainId, DomainMode } from "../../types";
import { useI18n } from "../bridge";
import type { PanelActions } from "../panel-actions";

export interface AddDomainFlowProps {
  actions: PanelActions;
  i18n: I18nService;
  settings?: { indexFileName: string };
  onClose(): void;
}

export function AddDomainFlow(props: AddDomainFlowProps): React.JSX.Element {
  const { t } = useI18n(props.i18n);
  const [step, setStep] = useState<1 | 2>(1);
  const [filter, setFilter] = useState("");
  const [folder, setFolder] = useState<DomainId | null>(null);
  const [mode, setMode] = useState<DomainMode>("independent");
  /** manually expanded tree nodes (irrelevant while filtering) */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const tree = useMemo(() => props.actions.listFolderTree(), [props.actions]);

  /** while filtering: keep matching folders and their ancestors, all expanded */
  const visibleTree = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (q === "") return { nodes: tree, filtering: false };
    const keep = (node: FolderTreeNode): FolderTreeNode | null => {
      const children = node.children
        .map(keep)
        .filter((child): child is FolderTreeNode => child !== null);
      if (!node.path.toLowerCase().includes(q) && children.length === 0) return null;
      return { ...node, children };
    };
    return {
      nodes: tree.map(keep).filter((node): node is FolderTreeNode => node !== null),
      filtering: true,
    };
  }, [tree, filter]);

  const selected = useMemo(() => {
    if (!folder) return null;
    const walk = (node: FolderTreeNode): FolderTreeNode | null => {
      if (node.path === folder) return node;
      for (const child of node.children) {
        const hit = walk(child);
        if (hit) return hit;
      }
      return null;
    };
    for (const node of tree) {
      const hit = walk(node);
      if (hit) return hit;
    }
    return null;
  }, [folder, tree]);

  const toggleExpand = (path: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const confirm = (): void => {
    if (step === 1) {
      if (folder) setStep(2);
      return;
    }
    props.onClose();
    if (folder) void props.actions.startManagingFlow(folder, mode);
  };

  return (
    <div
      className="ct-modal-overlay is-open"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div className="ct-modal">
        <div className="ct-modal-title">
          {t("Start managing a folder")}{" "}
          <span className="ct-note">{t(step === 1 ? "· Step 1 of 2" : "· Step 2 of 2")}</span>
        </div>

        {step === 1 ? (
          <>
            <input
              className="ct-input"
              style={{ width: "100%" }}
              placeholder={t("Filter folders…")}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <div className="ct-options ct-options-scroll ct-tree">
              {visibleTree.nodes.map((node) => (
                <TreeRow
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedPath={folder}
                  expanded={
                    visibleTree.filtering || expanded.has(node.path) || node.children.length === 0
                  }
                  filtering={visibleTree.filtering}
                  onToggleExpand={toggleExpand}
                  onSelect={setFolder}
                  t={t}
                />
              ))}
              {visibleTree.nodes.length === 0 && (
                <div className="ct-tree-empty">{t("No folders match the filter")}</div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="ct-modal-body">
              {t("Mode for <b>{folder}</b> — one managed domain, one chain style:", {
                folder: folder ?? "",
              })}
            </div>
            <div className="ct-options">
              <OptionRow
                selected={mode === "independent"}
                title={t("Independent · default")}
                description={t(
                  "Direct notes and managed subfolders mix in one ordering. Each managed subfolder keeps its own chain. Best for loosely related notes.",
                )}
                onClick={() => setMode("independent")}
              />
              <OptionRow
                selected={mode === "series"}
                title={t("Series · one chain")}
                description={t(
                  "One chain across the whole subtree; subfolders become path labels only. Best for tutorials and serials.",
                )}
                onClick={() => setMode("series")}
              />
            </div>
            <div
              className="ct-modal-warn"
              dangerouslySetInnerHTML={{
                __html:
                  (selected && selected.orderless > 0
                    ? `${t("{n} orderless notes will get 10000-step orders by filename order", {
                        n: selected.orderless,
                      })}<br>`
                    : "") +
                  t(
                    "Creates <b>{indexFile}.md</b> with <code>is-index: true</code> and a plugin-owned marked block. Recognition is by the marker, not the file name — you can rename the file later. Mode is stored in the index page’s frontmatter and can be switched any time.",
                    { indexFile: props.settings?.indexFileName ?? "目录" },
                  ),
              }}
            />
          </>
        )}

        <div className="ct-modal-actions">
          {step === 2 ? (
            <button type="button" className="ct-btn" onClick={() => setStep(1)}>
              {t("Back")}
            </button>
          ) : (
            <button type="button" className="ct-btn" onClick={props.onClose}>
              {t("Cancel")}
            </button>
          )}
          <button type="button" className="ct-btn is-accent" onClick={confirm}>
            {step === 1 ? t("Next") : t("Start managing")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** lucide chevron with a generous click target (round 21): the plain
 *  text arrow was too small to hit comfortably */
function TreeCaret(props: { open: boolean; hasChildren: boolean; onToggle(): void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) setIcon(ref.current, "chevron-right");
  }, []);
  return (
    <span
      ref={ref}
      className={`ct-tree-caret${props.open ? " is-open" : ""}${props.hasChildren ? "" : " is-empty"}`}
      onClick={(event) => {
        event.stopPropagation();
        if (props.hasChildren) props.onToggle();
      }}
    />
  );
}

function TreeRow(props: {
  node: FolderTreeNode;
  depth: number;
  selectedPath: DomainId | null;
  expanded: boolean;
  filtering: boolean;
  onToggleExpand(path: string): void;
  onSelect(path: DomainId): void;
  t: (key: string, params?: Record<string, string | number>) => string;
}): React.JSX.Element {
  const { node, depth, t } = props;
  const hasChildren = node.children.length > 0;
  const isOpen = props.expanded && hasChildren;
  const selected = props.selectedPath === node.path;
  // the only non-selectable reasons: already a domain root, or inside a
  // series domain — services encodes both, the UI just branches on them
  const meta = node.managed
    ? t("already managed")
    : !node.selectable
      ? t("inside a series domain")
      : t("{n} notes · {n2} subfolder · no index page yet", {
          n: node.notes,
          n2: node.subfolders,
        });

  return (
    <>
      {/* the WHOLE row is the click target (round 22): clicking anywhere
       * selects a selectable folder or expands a non-selectable one; the
       * caret keeps its own toggle via stopPropagation */}
      <div
        className={`ct-tree-row${selected ? " is-selected" : ""}${node.selectable ? "" : " is-disabled"}`}
        style={{ paddingLeft: depth * 16 }}
        title={node.path}
        onClick={() => {
          if (node.selectable) props.onSelect(node.path);
          else if (hasChildren) props.onToggleExpand(node.path);
        }}
      >
        <TreeCaret
          open={isOpen}
          hasChildren={hasChildren}
          onToggle={() => props.onToggleExpand(node.path)}
        />
        <span className="ct-tree-name">{node.name}</span>
        {meta !== "" && <span className="ct-tree-meta">{meta}</span>}
      </div>
      {isOpen &&
        node.children.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={props.selectedPath}
            expanded={props.expanded}
            filtering={props.filtering}
            onToggleExpand={props.onToggleExpand}
            onSelect={props.onSelect}
            t={t}
          />
        ))}
    </>
  );
}

function OptionRow(props: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  onClick(): void;
}): React.JSX.Element {
  return (
    <div
      className={`ct-option${props.selected ? " is-selected" : ""}${props.disabled ? " is-disabled" : ""}`}
      onClick={props.onClick}
    >
      <span className="ct-radio" />
      <div>
        <div className="ct-option-tt">{props.title}</div>
        <div className="ct-option-d">{props.description}</div>
      </div>
    </div>
  );
}
