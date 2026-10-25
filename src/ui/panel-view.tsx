/**
 * The management panel as an Obsidian ItemView: React renders into
 * contentEl via createRoot; unmount happens in onClose (DESIGN §3.3).
 */
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import type { RegistryStore } from "../adapter/registry-store";
import type { I18nService } from "../i18n/runtime";
import type { ChapterTrailSettings } from "../settings";
import { PanelRoot } from "./PanelRoot";
import type { PanelActions } from "./panel-actions";

export const VIEW_TYPE_CHAPTER_TRAIL = "chapter-trail-panel";

export interface PanelViewProps {
  store: RegistryStore;
  i18n: I18nService;
  settings: ChapterTrailSettings;
  actions: PanelActions;
}

export class ChapterTrailPanelView extends ItemView {
  private root: Root | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly props: PanelViewProps,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CHAPTER_TRAIL;
  }

  getDisplayText(): string {
    return this.props.i18n.t("Chapter Trail");
  }

  getIcon(): string {
    return "list-ordered";
  }

  async onOpen(): Promise<void> {
    this.root = createRoot(this.contentEl);
    this.root.render(
      <PanelRoot
        store={this.props.store}
        i18n={this.props.i18n}
        settings={this.props.settings}
        actions={this.props.actions}
      />,
    );
  }

  async onClose(): Promise<void> {
    await new Promise<void>((resolve) => {
      // React 19 unmount is async; flush before the leaf goes away
      this.root?.unmount();
      resolve();
    });
    this.root = null;
  }
}
