import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { createBrowserStorage } from "../../utils/browser-storage";
import type { VisibilityOverride } from "../tree-list/tree-list-visibility.store";

interface TabVisibilitySnapshot {
  tabOverrides: Record<string, VisibilityOverride>;
}

interface TabVisibilityState extends TabVisibilitySnapshot {
  setTab: (key: string, value: VisibilityOverride | undefined) => void;
  toggleTab: (key: string, hiddenByDefault: boolean) => void;
  clearTab: (key: string) => void;
  reset: () => void;
}

interface CreateTabVisibilityStoreOptions {
  storageKey: string;
}

const DEFAULT_SNAPSHOT: TabVisibilitySnapshot = { tabOverrides: {} };

const STORE_NAMESPACE = "pstdio/ui/tab-visibility";

const toStorageName = (storageKey: string) => `${STORE_NAMESPACE}/${storageKey}`;

const resolveEffective = (override: VisibilityOverride | undefined, hiddenByDefault: boolean): VisibilityOverride =>
  override ?? (hiddenByDefault ? "hidden" : "shown");

const setOverride = (
  overrides: Record<string, VisibilityOverride>,
  key: string,
  value: VisibilityOverride | undefined,
) => {
  if (value === undefined) {
    if (!(key in overrides)) return overrides;
    const { [key]: _removed, ...rest } = overrides;
    return rest;
  }
  if (overrides[key] === value) return overrides;
  return { ...overrides, [key]: value };
};

const toggleOverride = (overrides: Record<string, VisibilityOverride>, key: string, hiddenByDefault: boolean) => {
  const current = resolveEffective(overrides[key], hiddenByDefault);
  return setOverride(overrides, key, current === "hidden" ? "shown" : "hidden");
};

const getPersistedSnapshot = (state: TabVisibilityState) => ({ tabOverrides: state.tabOverrides });

export const createTabVisibilityStore = (options: CreateTabVisibilityStoreOptions) =>
  createStore<TabVisibilityState>()(
    persist(
      (set) => ({
        ...DEFAULT_SNAPSHOT,
        setTab: (key, value) =>
          set((state) => ({ ...state, tabOverrides: setOverride(state.tabOverrides, key, value) })),
        toggleTab: (key, hiddenByDefault) =>
          set((state) => ({ ...state, tabOverrides: toggleOverride(state.tabOverrides, key, hiddenByDefault) })),
        clearTab: (key) =>
          set((state) => ({ ...state, tabOverrides: setOverride(state.tabOverrides, key, undefined) })),
        reset: () => set(DEFAULT_SNAPSHOT),
      }),
      {
        name: toStorageName(options.storageKey),
        storage: createJSONStorage(createBrowserStorage),
        partialize: getPersistedSnapshot,
      },
    ),
  );

const storeRegistry = new Map<string, ReturnType<typeof createTabVisibilityStore>>();

export const getTabVisibilityStore = (storageKey: string) => {
  const existing = storeRegistry.get(storageKey);
  if (existing) return existing;
  const store = createTabVisibilityStore({ storageKey });
  storeRegistry.set(storageKey, store);
  return store;
};

export const useTabVisibilityStore = <T>(storageKey: string, selector: (state: TabVisibilityState) => T) => {
  const store = getTabVisibilityStore(storageKey);
  return useStore(store, selector);
};

export type { TabVisibilitySnapshot, TabVisibilityState };
