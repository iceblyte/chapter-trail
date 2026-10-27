/**
 * DomainCard — one managed domain (prototype 01/02): header with mode
 * badge and kebab menu, stacked status chips, the virtualized entry
 * list and the action buttons.
 */

import { setIcon } from "obsidian";
import { useEffect, useRef, useState } from "react";
import type { I18nService } from "../../i18n/runtime";
import type { ChapterTrailSettings } from "../../settings";
import type { ManagedDomain } from "../../types";
import { useI18n } from "../bridge";
import type { PanelActions } from "../panel-actions";
import { EntryList } from "./EntryList";

export interface DomainCardProps {
  domain: ManagedDomain;
  settings: ChapterTrailSettings;
  actions: PanelActions;
  i18n: I18nService;
  /** controlled by the panel (global expand/collapse button) */
  open: boolean;
  onToggleOpen(): void;
  /** series tree expansion, owned by the panel (survives remounts) */
  expandedFolders: ReadonlySet<string>;
  onToggleFolder(path: string): void;
}

export function DomainCard(props: DomainCardProps): React.JSX.Element {
  const { domain, settings, actions } = props;
  const { t } = useI18n(props.i18n);
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const managedIconRef = useRef<HTMLSpanElement>(null);

  /* the "managed" marker icon reflects the fold state */
  useEffect(() => {
    if (!managedIconRef.current) return;
    setIcon(managedIconRef.current, props.open ? "folder-open" : "folder");
  }, [props.open]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent): void => {
      if (!cardRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  const status = domain.status;
  const conflictMode = status.conflicts.length > 0;

  const cardElRef = (el: HTMLDivElement | null): void => {
    if (el) {
      (el as HTMLDivElement & { __ctEntries?: unknown }).__ctEntries = domain.entries.map(
        (entry) => [entry.path, entry.order],
      );
    }
  };
  void cardElRef;
  return (
    <div className="ct-card" ref={cardElRef}>
      <div
        className="ct-card-head ct-card-head-click"
        title={t(props.open ? "Collapse" : "Expand")}
        onClick={() => props.onToggleOpen()}
      >
        <span className="ct-managed-icon" ref={managedIconRef} />
        <span className="ct-card-path">{domain.root}</span>
        <span className={`ct-mode-badge${domain.mode === "series" ? " is-series" : ""}`}>
          {t(domain.mode === "series" ? "Series" : "Independent")}
        </span>
        <button
          type="button"
          className="ct-icon-btn"
          title={t("Copy domain path")}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          ⋮
        </button>
        {menuOpen && (
          <div className="ct-menu is-open" style={{ top: "30px", right: "8px" }}>
            <button
              type="button"
              className="ct-menu-item"
              onClick={() => {
                setMenuOpen(false);
                actions.openIndexPage(domain.indexPath);
              }}
            >
              {t("Open index page")}
            </button>
            <button
              type="button"
              className="ct-menu-item"
              onClick={() => {
                setMenuOpen(false);
                actions.copyDomainPath(domain.root);
              }}
            >
              {t("Copy domain path")}
            </button>
            <div className="ct-menu-sep" />
            <button
              type="button"
              className="ct-menu-item is-danger"
              onClick={() => {
                setMenuOpen(false);
                void actions.stopManaging(domain.root);
              }}
            >
              {t("Stop managing…")}
            </button>
          </div>
        )}
      </div>

      {props.open && (
        <>
          <div className="ct-chips">
            {status.broken.length > 0 && (
              <Chip tone="is-red" label={t("{n} broken links", { n: status.broken.length })} />
            )}
            {conflictMode && <Chip tone="is-red" label={t("Nested index conflict")} />}
            {status.pending.length > 0 && (
              <Chip tone="is-blue" label={t("{n} need ordering", { n: status.pending.length })} />
            )}
            {status.stale && <Chip tone="is-yellow" label={t("Index outdated")} />}
            {status.tightGap && <Chip tone="is-yellow" label={t("Gaps too tight")} />}
            {status.ties.length > 0 && (
              <Chip tone="is-yellow" label={t("{n} tied orders", { n: status.ties.length })} />
            )}
            {status.legacyHint && (
              <Chip tone="is-yellow" label={t("First run: review suggested order")} />
            )}
          </div>

          {conflictMode ? (
            <div className="ct-rows">
              {status.conflicts.map((conflict) => (
                <div key={conflict.path} className="ct-row is-dim">
                  <span className="ct-row-title">
                    <code>{conflict.path}</code> — {t("Nested index page detected")}
                  </span>
                </div>
              ))}
              <div className="ct-row is-dim">
                <span className="ct-row-title">
                  {t("resolve: demote to note / delete / exclude folder")}
                </span>
              </div>
            </div>
          ) : (
            <EntryList
              domain={domain}
              settings={settings}
              actions={actions}
              i18n={props.i18n}
              expandedFolders={props.expandedFolders}
              onToggleFolder={props.onToggleFolder}
            />
          )}

          <div className="ct-card-actions">
            {conflictMode ? (
              <button
                type="button"
                className="ct-btn is-accent"
                onClick={() =>
                  void actions.resolveConflict(
                    domain.root,
                    status.conflicts[0]?.path ?? domain.indexPath,
                  )
                }
              >
                {t("Resolve…")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="ct-btn"
                  onClick={() => void actions.rebuildIndex(domain.root)}
                >
                  {t("Rebuild index")}
                </button>
                <button
                  type="button"
                  className="ct-btn"
                  onClick={() => void actions.reindexOrder(domain.root)}
                >
                  {t("Reindex order")}
                </button>
                {settings.injectNavEnabled && (
                  <button
                    type="button"
                    className="ct-btn"
                    onClick={() => void actions.rebuildInjection(domain.root)}
                  >
                    {t("Rebuild injection")}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Chip(props: { tone: string; label: string }): React.JSX.Element {
  const dotTone =
    props.tone === "is-red" ? "is-red" : props.tone === "is-yellow" ? "is-yellow" : "is-blue";
  return (
    <span className={`ct-chip ${props.tone}`}>
      <span className={`ct-dot ${dotTone}`} />
      {props.label}
    </span>
  );
}
