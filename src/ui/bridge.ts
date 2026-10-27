/**
 * React bridge — external stores (registry + i18n) consumed through
 * useSyncExternalStore so the panel never copies business state
 * (DESIGN.md §3.3).
 */
import { useSyncExternalStore } from "react";
import type { RegistryStore } from "../adapter/registry-store";
import type { Lang } from "../i18n/index";
import type { I18nService } from "../i18n/runtime";
import type { Registry } from "../types";

export function useRegistry(store: RegistryStore): Registry {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot(),
  );
}

export function useRegistryVersion(store: RegistryStore): number {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getVersion(),
  );
}

export interface I18nBinding {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useI18n(i18n: I18nService): I18nBinding {
  const lang = useSyncExternalStore(
    (cb) => i18n.subscribe(cb),
    () => i18n.getLang(),
  );
  return { lang, t: (key, params) => i18n.t(key, params) };
}
