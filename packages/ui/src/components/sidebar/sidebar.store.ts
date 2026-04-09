import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

interface SidebarSnapshot {
  open: boolean;
  expandedSections: string[];
  expandedNodes: string[];
}

interface SidebarState extends SidebarSnapshot {
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  toggleSection: (sectionId: string) => void;
  toggleNode: (nodeId: string) => void;
  setSectionExpanded: (sectionId: string, expanded: boolean) => void;
  setNodeExpanded: (nodeId: string, expanded: boolean) => void;
  reset: () => void;
}

interface CreateSidebarStoreOptions {
  storageKey: string;
  initialState?: Partial<SidebarSnapshot>;
}

const DEFAULT_SNAPSHOT = {
  open: true,
  expandedSections: [],
  expandedNodes: [],
} satisfies SidebarSnapshot;

const SIDEBAR_STORE_NAMESPACE = "pstdio/ui/sidebar";

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

const getPersistedSnapshot = (state: SidebarState) => ({
  open: state.open,
  expandedSections: state.expandedSections,
  expandedNodes: state.expandedNodes,
});

export const createSidebarStore = (options: CreateSidebarStoreOptions) => {
  const { storageKey, initialState } = options;
  const snapshot = { ...DEFAULT_SNAPSHOT, ...initialState };

  return createStore<SidebarState>()(
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

const sidebarStoreRegistry = new Map<string, ReturnType<typeof createSidebarStore>>();

export const getSidebarStore = (storageKey: string, initialState?: Partial<SidebarSnapshot>) => {
  const existingStore = sidebarStoreRegistry.get(storageKey);

  if (existingStore) {
    return existingStore;
  }

  const store = createSidebarStore({ storageKey, initialState });
  sidebarStoreRegistry.set(storageKey, store);

  return store;
};

export const useSidebarStore = <T>(
  storageKey: string,
  selector: (state: SidebarState) => T,
  initialState?: Partial<SidebarSnapshot>,
) => {
  const store = getSidebarStore(storageKey, initialState);
  return useStore(store, selector);
};
