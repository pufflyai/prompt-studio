import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import {
  createHostPersistStorage,
  createHostStoreRegistry,
  type HostStorage,
  useHostStorage,
} from "../../utils/host-storage";

interface TreeListOrderSnapshot {
  sectionOrder: string[];
  nodeOrderBySection: Record<string, string[]>;
  sectionSlotById: Record<string, TreeListOrderSlot>;
}

type TreeListOrderSlot = "header" | "content" | "footer";

interface TreeListOrderState extends TreeListOrderSnapshot {
  setSectionOrder: (nextSectionIds: string[]) => void;
  setNodeOrder: (sectionId: string, nextNodeIds: string[]) => void;
  setSectionSlot: (sectionId: string, slot: TreeListOrderSlot) => void;
  resetSectionOrder: () => void;
  resetNodeOrder: (sectionId: string) => void;
  reset: () => void;
}

interface CreateTreeListOrderStoreOptions {
  storageKey: string;
  storage?: HostStorage;
}

const DEFAULT_SNAPSHOT: TreeListOrderSnapshot = {
  sectionOrder: [],
  nodeOrderBySection: {},
  sectionSlotById: {},
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
  sectionSlotById: state.sectionSlotById,
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
        setSectionSlot: (sectionId, slot) =>
          set((state) => ({ ...state, sectionSlotById: { ...state.sectionSlotById, [sectionId]: slot } })),
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
        storage: createHostPersistStorage(options.storage),
        partialize: getPersistedSnapshot,
      },
    ),
  );

export const getTreeListOrderStore = createHostStoreRegistry((storageKey, storage) =>
  createTreeListOrderStore({ storageKey, storage }),
);

export const useTreeListOrderStore = <T>(storageKey: string, selector: (state: TreeListOrderState) => T) => {
  const store = getTreeListOrderStore(storageKey, useHostStorage());
  return useStore(store, selector);
};

export type { TreeListOrderSlot, TreeListOrderSnapshot, TreeListOrderState };
