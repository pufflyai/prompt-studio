import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

interface SidebarNextSnapshot {
  open: boolean;
  expandedSections: string[];
  expandedNodes: string[];
}

interface SidebarNextState extends SidebarNextSnapshot {
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  toggleSection: (sectionId: string) => void;
  toggleNode: (nodeId: string) => void;
  setSectionExpanded: (sectionId: string, expanded: boolean) => void;
  setNodeExpanded: (nodeId: string, expanded: boolean) => void;
  reset: () => void;
}

interface CreateSidebarNextStoreOptions {
  storageKey: string;
  initialState?: Partial<SidebarNextSnapshot>;
}

const DEFAULT_SNAPSHOT = {
  open: true,
  expandedSections: [],
  expandedNodes: [],
} satisfies SidebarNextSnapshot;

const SIDEBAR_STORE_NAMESPACE = "pstdio/ui/sidebar-next";

const toStorageName = (storageKey: string) => `${SIDEBAR_STORE_NAMESPACE}/${storageKey}`;

const createNoopStorage = () => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const toggleId = (values: string[], id: string) =>
  values.includes(id) ? values.filter((value) => value !== id) : [...values, id];

const setExpanded = (values: string[], id: string, expanded: boolean) => {
  if (expanded) {
    return values.includes(id) ? values : [...values, id];
  }

  return values.filter((value) => value !== id);
};

const getPersistedSnapshot = (state: SidebarNextState) => ({
  open: state.open,
  expandedSections: state.expandedSections,
  expandedNodes: state.expandedNodes,
});

export const createSidebarNextStore = (options: CreateSidebarNextStoreOptions) => {
  const { storageKey, initialState } = options;
  const snapshot = { ...DEFAULT_SNAPSHOT, ...initialState };

  return createStore<SidebarNextState>()(
    persist(
      (set) => ({
        ...snapshot,
        openSidebar: () => set((state) => ({ ...state, open: true })),
        closeSidebar: () => set((state) => ({ ...state, open: false })),
        toggleSidebar: () => set((state) => ({ ...state, open: !state.open })),
        toggleSection: (sectionId) =>
          set((state) => ({
            ...state,
            expandedSections: toggleId(state.expandedSections, sectionId),
          })),
        toggleNode: (nodeId) =>
          set((state) => ({
            ...state,
            expandedNodes: toggleId(state.expandedNodes, nodeId),
          })),
        setSectionExpanded: (sectionId, expanded) =>
          set((state) => ({
            ...state,
            expandedSections: setExpanded(state.expandedSections, sectionId, expanded),
          })),
        setNodeExpanded: (nodeId, expanded) =>
          set((state) => ({
            ...state,
            expandedNodes: setExpanded(state.expandedNodes, nodeId, expanded),
          })),
        reset: () => set(DEFAULT_SNAPSHOT),
      }),
      {
        name: toStorageName(storageKey),
        storage: createJSONStorage(() => {
          if (typeof globalThis.localStorage === "undefined") {
            return createNoopStorage();
          }

          return globalThis.localStorage;
        }),
        partialize: getPersistedSnapshot,
      },
    ),
  );
};

const sidebarStoreRegistry = new Map<string, ReturnType<typeof createSidebarNextStore>>();

export const getSidebarNextStore = (storageKey: string) => {
  const existingStore = sidebarStoreRegistry.get(storageKey);

  if (existingStore) {
    return existingStore;
  }

  const store = createSidebarNextStore({ storageKey });
  sidebarStoreRegistry.set(storageKey, store);

  return store;
};

export const useSidebarNextStore = <T>(storageKey: string, selector: (state: SidebarNextState) => T) => {
  const store = getSidebarNextStore(storageKey);
  return useStore(store, selector);
};
