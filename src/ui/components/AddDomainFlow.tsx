/**
 * AddDomainFlow — the two-step start-managing flow (prototype 04):
 * pick a folder (filter + managed ones disabled), then pick a mode with
 * the consequences spelled out. Rendered as an overlay inside the panel.
 */
import { useMemo, useState } from "react";
import type { I18nService } from "../../i18n/runtime";
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

  const candidates = useMemo(() => props.actions.listFolderCandidates(), [props.actions]);
  const filtered = candidates.filter((candidate) =>
    candidate.path.toLowerCase().includes(filter.toLowerCase()),
  );
  const selected = candidates.find((candidate) => candidate.path === folder);

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
            <div className="ct-options ct-options-scroll">
              {filtered.map((candidate) => (
                <OptionRow
                  key={candidate.path}
                  selected={folder === candidate.path}
                  disabled={candidate.managed}
                  title={candidate.path}
                  description={
                    candidate.managed
                      ? t("already managed")
                      : t("{n} notes · {n2} subfolder · no index page yet", {
                          n: candidate.noteCount,
                          n2: candidate.subfolderCount,
                        })
                  }
                  onClick={() => !candidate.managed && setFolder(candidate.path)}
                />
              ))}
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
                title="Series"
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
                  (selected && selected.orderlessCount > 0
                    ? `${t("{n} orderless notes will get 10000-step orders by filename order", {
                        n: selected.orderlessCount,
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
