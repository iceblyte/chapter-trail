/**
 * Runtime i18n service — one subscribable source of truth for the UI
 * language so the React panel, Obsidian settings tab and command palette
 * re-label together when Language changes (PRD §2.7).
 */
import type { Lang } from "./index";
import { en, interpolate, lookup, zh } from "./index";

export class I18nService {
  private lang: Lang;
  private listeners = new Set<() => void>();

  constructor(lang: Lang) {
    this.lang = lang;
  }

  getLang(): Lang {
    return this.lang;
  }

  setLang(lang: Lang): void {
    if (this.lang === lang) return;
    this.lang = lang;
    for (const listener of this.listeners) listener();
  }

  /** Translate a key (the English copy) with optional {params}. */
  t(key: string, params?: Record<string, string | number>): string {
    const dict = this.lang === "zh" ? zh : en;
    return interpolate(lookup(dict, key), params);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
