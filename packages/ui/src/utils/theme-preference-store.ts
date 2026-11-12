import { createPreferenceChoiceStore } from "./preference-choice-store";
import type { ThemePreferenceStorage } from "./theme-preference";

const windows = new WeakMap<
  Window,
  WeakMap<ThemePreferenceStorage, Map<string, ReturnType<typeof createThemePreferenceStore>>>
>();

export const createThemePreferenceStore = (storage: ThemePreferenceStorage, key: string, initial?: string) =>
  createPreferenceChoiceStore(storage, key, initial);

/** Equal storage adapters and keys represent one shared choice in the window. */
export const getThemePreferenceStore = (storage: ThemePreferenceStorage, key: string, browserStorage: boolean) => {
  if (typeof window === "undefined") return createThemePreferenceStore(storage, key);
  let adapters = windows.get(window);
  if (!adapters) {
    adapters = new WeakMap();
    windows.set(window, adapters);
  }
  let keys = adapters.get(storage);
  if (!keys) {
    keys = new Map();
    adapters.set(storage, keys);
  }
  let store = keys.get(key);
  if (!store) {
    const created = createThemePreferenceStore(storage, key);
    store = created;
    keys.set(key, created);
    if (browserStorage)
      window.addEventListener?.("storage", (event) => {
        if (event.storageArea !== window.localStorage) return;
        if (event.key === key) created.update(event.newValue);
        else if (event.key === null) created.update(null);
      });
  }
  return store;
};
