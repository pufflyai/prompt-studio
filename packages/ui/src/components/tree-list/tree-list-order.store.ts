import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { createBrowserStorage } from "../../utils/browser-storage";

interface TreeListOrderSnapshot {
  sectionOrder: string[];
  nodeOrderBySection: Record<string, string[]>;
}

interface TreeListOrderState extends TreeListOrderSnapshot {
  setSectionOrder: (nextSectionIds: string[]) => void;
  setNodeOrder: (sectionId: string, nextNodeIds: string[]) => void;
  resetSectionOrder: () => void;
  resetNodeOrder: (sectionId: string) => void;
  reset: () => void;
}

interface CreateTreeListOrderStoreOptions {
  storageKey: string;
}

const DEFAULT_SNAPSHOT: TreeListOrderSnapshot = {
  sectionOrder: [],
  nodeOrderBySection: {},
};

const STORE_NAMESPACE = "pstdio/ui/tree-list-order";

const toStorageName = (storageKey: string) => `${STORE_NAMESPACE}/${storageKey}`;

const dedupe = (ids: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

const getPersistedSnapshot = (state: TreeListOrderState) => ({
  sectionOrder: state.sectionOrder,
  nodeOrderBySection: state.nodeOrderBySection,
});

export const createTreeListOrderStore = (options: CreateTreeListOrderStoreOptions) =>
  createStore<TreeListOrderState>()(
    persist(
      (set) => ({
        ...DEFAULT_SNAPSHOT,
        setSectionOrder: (nextSectionIds) => set((state) => ({ ...state, sectionOrder: dedupe(nextSectionIds) })),
        setNodeOrder: (sectionId, nextNodeIds) =>
          set((state) => ({
            ...state,
            nodeOrderBySection: { ...state.nodeOrderBySection, [sectionId]: dedupe(nextNodeIds) },
          })),
        resetSectionOrder: () => set((state) => ({ ...state, sectionOrder: [] })),
        resetNodeOrder: (sectionId) =>
          set((state) => {
            if (!(sectionId in state.nodeOrderBySection)) return state;
            const { [sectionId]: _removed, ...rest } = state.nodeOrderBySection;
            return { ...state, nodeOrderBySection: rest };
          }),
        reset: () => set(DEFAULT_SNAPSHOT),
      }),
      {
        name: toStorageName(options.storageKey),
        storage: createJSONStorage(createBrowserStorage),
        partialize: getPersistedSnapshot,
      },
    ),
  );

const storeRegistry = new Map<string, ReturnType<typeof createTreeListOrderStore>>();

export const getTreeListOrderStore = (storageKey: string) => {
  const existing = storeRegistry.get(storageKey);
  if (existing) return existing;

  const store = createTreeListOrderStore({ storageKey });
  storeRegistry.set(storageKey, store);
  return store;
};

export const useTreeListOrderStore = <T>(storageKey: string, selector: (state: TreeListOrderState) => T) => {
  const store = getTreeListOrderStore(storageKey);
  return useStore(store, selector);
};

export type { TreeListOrderSnapshot, TreeListOrderState };
