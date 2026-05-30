import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { createBrowserStorage } from "../../utils/browser-storage";

export type VisibilityOverride = "hidden" | "shown";

interface TreeListVisibilitySnapshot {
  sectionOverrides: Record<string, VisibilityOverride>;
  nodeOverrides: Record<string, VisibilityOverride>;
}

interface TreeListVisibilityState extends TreeListVisibilitySnapshot {
  setSection: (id: string, value: VisibilityOverride | undefined) => void;
  setNode: (id: string, value: VisibilityOverride | undefined) => void;
  toggleSection: (id: string, hiddenByDefault: boolean) => void;
  toggleNode: (id: string, hiddenByDefault: boolean) => void;
  clearSection: (id: string) => void;
  clearNode: (id: string) => void;
  reset: () => void;
}

interface CreateTreeListVisibilityStoreOptions {
  storageKey: string;
}

const DEFAULT_SNAPSHOT: TreeListVisibilitySnapshot = {
  sectionOverrides: {},
  nodeOverrides: {},
};

const STORE_NAMESPACE = "pstdio/ui/tree-list-visibility";

const toStorageName = (storageKey: string) => `${STORE_NAMESPACE}/${storageKey}`;

const resolveEffective = (override: VisibilityOverride | undefined, hiddenByDefault: boolean): VisibilityOverride =>
  override ?? (hiddenByDefault ? "hidden" : "shown");

const flipOverride = (current: VisibilityOverride): VisibilityOverride => (current === "hidden" ? "shown" : "hidden");

const setOverride = (
  overrides: Record<string, VisibilityOverride>,
  id: string,
  value: VisibilityOverride | undefined,
) => {
  if (value === undefined) {
    if (!(id in overrides)) return overrides;
    const { [id]: _removed, ...rest } = overrides;
    return rest;
  }

  if (overrides[id] === value) return overrides;
  return { ...overrides, [id]: value };
};

const toggleOverride = (overrides: Record<string, VisibilityOverride>, id: string, hiddenByDefault: boolean) => {
  const next = flipOverride(resolveEffective(overrides[id], hiddenByDefault));
  return setOverride(overrides, id, next);
};

const getPersistedSnapshot = (state: TreeListVisibilityState) => ({
  sectionOverrides: state.sectionOverrides,
  nodeOverrides: state.nodeOverrides,
});

export const createTreeListVisibilityStore = (options: CreateTreeListVisibilityStoreOptions) =>
  createStore<TreeListVisibilityState>()(
    persist(
      (set) => ({
        ...DEFAULT_SNAPSHOT,
        setSection: (id, value) =>
          set((state) => ({ ...state, sectionOverrides: setOverride(state.sectionOverrides, id, value) })),
        setNode: (id, value) =>
          set((state) => ({ ...state, nodeOverrides: setOverride(state.nodeOverrides, id, value) })),
        toggleSection: (id, hiddenByDefault) =>
          set((state) => ({
            ...state,
            sectionOverrides: toggleOverride(state.sectionOverrides, id, hiddenByDefault),
          })),
        toggleNode: (id, hiddenByDefault) =>
          set((state) => ({
            ...state,
            nodeOverrides: toggleOverride(state.nodeOverrides, id, hiddenByDefault),
          })),
        clearSection: (id) =>
          set((state) => ({ ...state, sectionOverrides: setOverride(state.sectionOverrides, id, undefined) })),
        clearNode: (id) =>
          set((state) => ({ ...state, nodeOverrides: setOverride(state.nodeOverrides, id, undefined) })),
        reset: () => set(DEFAULT_SNAPSHOT),
      }),
      {
        name: toStorageName(options.storageKey),
        storage: createJSONStorage(createBrowserStorage),
        partialize: getPersistedSnapshot,
      },
    ),
  );

const storeRegistry = new Map<string, ReturnType<typeof createTreeListVisibilityStore>>();

export const getTreeListVisibilityStore = (storageKey: string) => {
  const existing = storeRegistry.get(storageKey);
  if (existing) return existing;

  const store = createTreeListVisibilityStore({ storageKey });
  storeRegistry.set(storageKey, store);
  return store;
};

export const useTreeListVisibilityStore = <T>(storageKey: string, selector: (state: TreeListVisibilityState) => T) => {
  const store = getTreeListVisibilityStore(storageKey);
  return useStore(store, selector);
};

export type { TreeListVisibilitySnapshot, TreeListVisibilityState };
