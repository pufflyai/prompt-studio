import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { createBrowserStorage } from "../../utils/browser-storage";

interface SidenavSnapshot {
  open: boolean;
  expandedSections: string[];
  expandedNodes: string[];
  width: number | null;
}

interface SidenavState extends SidenavSnapshot {
  openSidenav: () => void;
  closeSidenav: () => void;
  toggleSidenav: () => void;
  toggleSection: (sectionId: string) => void;
  toggleNode: (nodeId: string) => void;
  setSectionExpanded: (sectionId: string, expanded: boolean) => void;
  setNodeExpanded: (nodeId: string, expanded: boolean) => void;
  setWidth: (width: number) => void;
  reset: () => void;
}

interface CreateSidenavStoreOptions {
  storageKey: string;
  initialState?: Partial<SidenavSnapshot>;
}

const DEFAULT_SNAPSHOT = {
  open: true,
  expandedSections: [],
  expandedNodes: [],
  width: null,
} satisfies SidenavSnapshot;

const SIDENAV_STORE_NAMESPACE = "pstdio/ui/sidenav";

const toStorageName = (storageKey: string) => `${SIDENAV_STORE_NAMESPACE}/${storageKey}`;

const toggleId = (values: string[], id: string) =>
  values.includes(id) ? values.filter((value) => value !== id) : [...values, id];

const setExpanded = (values: string[], id: string, expanded: boolean) => {
  if (expanded) {
    return values.includes(id) ? values : [...values, id];
  }

  return values.filter((value) => value !== id);
};

const getPersistedSnapshot = (state: SidenavState) => ({
  open: state.open,
  expandedSections: state.expandedSections,
  expandedNodes: state.expandedNodes,
  width: state.width,
});

export const createSidenavStore = (options: CreateSidenavStoreOptions) => {
  const { storageKey, initialState } = options;
  const snapshot = { ...DEFAULT_SNAPSHOT, ...initialState };

  return createStore<SidenavState>()(
    persist(
      (set) => ({
        ...snapshot,
        openSidenav: () => set((state) => ({ ...state, open: true })),
        closeSidenav: () => set((state) => ({ ...state, open: false })),
        toggleSidenav: () => set((state) => ({ ...state, open: !state.open })),
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
        setWidth: (width) => set((state) => ({ ...state, width })),
        reset: () => set(DEFAULT_SNAPSHOT),
      }),
      {
        name: toStorageName(storageKey),
        storage: createJSONStorage(createBrowserStorage),
        partialize: getPersistedSnapshot,
      },
    ),
  );
};

const sidenavStoreRegistry = new Map<string, ReturnType<typeof createSidenavStore>>();

export const getSidenavStore = (storageKey: string, initialState?: Partial<SidenavSnapshot>) => {
  const existingStore = sidenavStoreRegistry.get(storageKey);

  if (existingStore) {
    return existingStore;
  }

  const store = createSidenavStore({ storageKey, initialState });
  sidenavStoreRegistry.set(storageKey, store);

  return store;
};

export const useSidenavStore = <T>(
  storageKey: string,
  selector: (state: SidenavState) => T,
  initialState?: Partial<SidenavSnapshot>,
) => {
  const store = getSidenavStore(storageKey, initialState);
  return useStore(store, selector);
};
