/**
 * EditorNav — the same display-only prev / overview / next nav for
 * Source mode & Live Preview, as CodeMirror 6 block widgets at the top
 * and bottom of the document. Never touches the document text.
 *
 * IMPORTANT: block decorations may only come from a StateField — a
 * ViewPlugin provider throws "Block decorations may not be specified
 * via plugins" at EditorState creation, which aborts file opening.
 * The field recomputes on every transaction (cheap: two ranges); the
 * widget's eq() keeps the DOM from churning.
 *
 * @codemirror/* resolve to the app's copy (peer deps, esbuild
 * external) so the facet identities match the host editor.
 */

import { type EditorState, type Extension, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
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

function computeDecorations(
  state: EditorState,
  deps: NavDeps,
  store: RegistryStore,
): DecorationSet {
  const info = state.field(editorInfoField, false);
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
    }).range(state.doc.length),
  ]);
}

/** Editor extension: display-only nav in Source mode & Live Preview. */
export function editorNavExtension(deps: NavDeps, store: RegistryStore): Extension {
  return StateField.define<DecorationSet>({
    create: (state) => safeDecorations(state, deps, store),
    update: (_value, tr) => safeDecorations(tr.state, deps, store),
    provide: (field) => EditorView.decorations.from(field),
  });
}

/** a broken decoration must never break the editor / file opening */
function safeDecorations(state: EditorState, deps: NavDeps, store: RegistryStore): DecorationSet {
  try {
    return computeDecorations(state, deps, store);
  } catch (error) {
    console.error("[chapter-trail] editor nav failed", error);
    return Decoration.none;
  }
}
