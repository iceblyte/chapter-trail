/**
 * EditorNav — the same display-only prev / overview / next nav for
 * Source mode & Live Preview, as CodeMirror 6 block widgets at the top
 * and bottom of the document. Never touches the document text.
 *
 * @codemirror/* resolve to the app's copy (peer deps, esbuild
 * external) so the extension facets match the host editor.
 */

import type { Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { editorInfoField } from "obsidian";
import { isUnder } from "../core/path-util";
import type { ManagedDomain } from "../types";
import { buildNavBox, type DynNavModel, dynNavModel, type NavDeps } from "./dynamic-nav";
import type { RegistryStore } from "./registry-store";

class NavWidget extends WidgetType {
  constructor(
    private readonly model: DynNavModel,
    private readonly side: "top" | "bottom",
    private readonly deps: NavDeps,
  ) {
    super();
  }

  override eq(other: NavWidget): boolean {
    return (
      other.side === this.side &&
      other.model.overview.path === this.model.overview.path &&
      other.model.prev?.path === this.model.prev?.path &&
      other.model.next?.path === this.model.next?.path
    );
  }

  toDOM(): HTMLElement {
    return buildNavBox(this.model, this.deps);
  }

  override ignoreEvent(): boolean {
    return false; // let link clicks work
  }
}

function computeDecorations(view: EditorView, deps: NavDeps, store: RegistryStore): DecorationSet {
  const info = view.state.field(editorInfoField, false);
  const file = info?.file;
  if (!file) return Decoration.none;

  const registry = store.getSnapshot();
  let best: ManagedDomain | null = null;
  for (const domain of registry.domains.values()) {
    if (!isUnder(file.path, domain.root)) continue;
    if (!best || domain.root.length > best.root.length) best = domain;
  }
  const model = best ? dynNavModel(best, file.path) : null;
  if (!model) return Decoration.none;

  return Decoration.set([
    Decoration.widget({
      widget: new NavWidget(model, "top", deps),
      block: true,
      side: -100,
    }).range(0),
    Decoration.widget({
      widget: new NavWidget(model, "bottom", deps),
      block: true,
      side: 100,
    }).range(view.state.doc.length),
  ]);
}

/** a broken decoration must never break the editor / file opening */
function safeDecorations(view: EditorView, deps: NavDeps, store: RegistryStore): DecorationSet {
  try {
    return computeDecorations(view, deps, store);
  } catch (error) {
    console.error("[chapter-trail] editor nav failed", error);
    return Decoration.none;
  }
}

/** Editor extension: display-only nav in Source mode & Live Preview. */
export function editorNavExtension(deps: NavDeps, store: RegistryStore): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = safeDecorations(view, deps, store);
      }

      update(update: ViewUpdate): void {
        this.decorations = safeDecorations(update.view, deps, store);
      }
    },
    { decorations: (value) => value.decorations },
  );
}
