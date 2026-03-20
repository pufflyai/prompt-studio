import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import { DEFAULT_WORKSPACE_SETTINGS, type FilterCategory, type FilterState, type WorkspaceSettings } from "./types";

interface WorkspaceSnapshot {
  settings: WorkspaceSettings;
  filters: FilterState;
}

interface WorkspaceState extends WorkspaceSnapshot {
  setViewMode: (viewMode: WorkspaceSettings["viewMode"]) => void;
  setColumnGrouping: (columnGrouping: WorkspaceSettings["columnGrouping"]) => void;
  setRowGrouping: (rowGrouping: WorkspaceSettings["rowGrouping"]) => void;
  setOrdering: (ordering: WorkspaceSettings["ordering"]) => void;
  setOrderingField: (field: WorkspaceSettings["ordering"]["field"]) => void;
  toggleSortDirection: () => void;
  toggleDisplayProperty: (property: WorkspaceSettings["displayProperties"][number]) => void;
  setFilter: (category: FilterCategory, values: string[]) => void;
  toggleFilterValue: (category: FilterCategory, value: string) => void;
  clearFilter: (category: FilterCategory) => void;
  clearAllFilters: () => void;
  reset: () => void;
}

interface CreateTicketsWorkspaceStoreOptions {
  storageKey: string;
  initialState?: Partial<WorkspaceSnapshot>;
}

const WORKSPACE_STORE_NAMESPACE = "pstdio/ui/tickets-workspace";

const toStorageName = (storageKey: string) => `${WORKSPACE_STORE_NAMESPACE}/${storageKey}`;

const DEFAULT_SNAPSHOT: WorkspaceSnapshot = {
  settings: DEFAULT_WORKSPACE_SETTINGS,
  filters: {},
};

const createNoopStorage = () => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

export const createTicketsWorkspaceStore = (options: CreateTicketsWorkspaceStoreOptions) => {
  const { storageKey, initialState } = options;
  const snapshot = {
    settings: { ...DEFAULT_SNAPSHOT.settings, ...(initialState?.settings ?? {}) },
    filters: initialState?.filters ?? DEFAULT_SNAPSHOT.filters,
  };

  return createStore<WorkspaceState>()(
    persist(
      (set) => ({
        ...snapshot,
        setViewMode: (viewMode) =>
          set((state) => ({
            ...state,
            settings: { ...state.settings, viewMode },
          })),
        setColumnGrouping: (columnGrouping) =>
          set((state) => ({
            ...state,
            settings: { ...state.settings, columnGrouping },
          })),
        setRowGrouping: (rowGrouping) =>
          set((state) => ({
            ...state,
            settings: { ...state.settings, rowGrouping },
          })),
        setOrdering: (ordering) =>
          set((state) => ({
            ...state,
            settings: { ...state.settings, ordering },
          })),
        setOrderingField: (field) =>
          set((state) => ({
            ...state,
            settings: {
              ...state.settings,
              ordering: {
                ...state.settings.ordering,
                field,
              },
            },
          })),
        toggleSortDirection: () =>
          set((state) => ({
            ...state,
            settings: {
              ...state.settings,
              ordering: {
                ...state.settings.ordering,
                direction: state.settings.ordering.direction === "asc" ? "desc" : "asc",
              },
            },
          })),
        toggleDisplayProperty: (property) =>
          set((state) => {
            const displayProperties = state.settings.displayProperties.includes(property)
              ? state.settings.displayProperties.filter((value) => value !== property)
              : [...state.settings.displayProperties, property];

            return {
              ...state,
              settings: {
                ...state.settings,
                displayProperties,
              },
            };
          }),
        setFilter: (category, values) =>
          set((state) => ({
            ...state,
            filters: {
              ...state.filters,
              [category]: values,
            },
          })),
        toggleFilterValue: (category, value) =>
          set((state) => {
            const currentValues = state.filters[category] ?? [];
            const nextValues = toggleValue(currentValues, value);
            const nextFilters = { ...state.filters, [category]: nextValues };

            if (nextValues.length === 0) {
              delete nextFilters[category];
            }

            return { ...state, filters: nextFilters };
          }),
        clearFilter: (category) =>
          set((state) => {
            const nextFilters = { ...state.filters };
            delete nextFilters[category];

            return {
              ...state,
              filters: nextFilters,
            };
          }),
        clearAllFilters: () => set((state) => ({ ...state, filters: {} })),
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
        partialize: (state) => ({
          settings: state.settings,
          filters: state.filters,
        }),
      },
    ),
  );
};

const workspaceStoreRegistry = new Map<string, ReturnType<typeof createTicketsWorkspaceStore>>();

export const getTicketsWorkspaceStore = (storageKey: string) => {
  const existingStore = workspaceStoreRegistry.get(storageKey);
  if (existingStore) {
    return existingStore;
  }

  const store = createTicketsWorkspaceStore({ storageKey });
  workspaceStoreRegistry.set(storageKey, store);

  return store;
};

export const useTicketsWorkspaceStore = <T>(storageKey: string, selector: (state: WorkspaceState) => T) => {
  const store = getTicketsWorkspaceStore(storageKey);
  return useStore(store, selector);
};

export type { WorkspaceState };
