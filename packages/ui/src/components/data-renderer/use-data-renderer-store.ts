import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { omitFilterCategory } from "./data-renderer-helpers";
import {
  type DataRendererFilterState,
  type DataRendererSettings,
  DEFAULT_DATA_RENDERER_SETTINGS,
  type DisplayProperty,
  type FilterCategory,
} from "./types";

interface DataRendererSnapshot {
  settings: DataRendererSettings;
  filters: DataRendererFilterState;
}

interface DataRendererState extends DataRendererSnapshot {
  setViewMode: (viewMode: DataRendererSettings["viewMode"]) => void;
  setColumnGrouping: (columnGrouping: DataRendererSettings["columnGrouping"]) => void;
  setRowGrouping: (rowGrouping: DataRendererSettings["rowGrouping"]) => void;
  setOrdering: (ordering: DataRendererSettings["ordering"]) => void;
  setOrderingField: (field: DataRendererSettings["ordering"]["field"]) => void;
  setDisplayProperties: (displayProperties: DisplayProperty[]) => void;
  toggleSortDirection: () => void;
  toggleDisplayProperty: (property: DataRendererSettings["displayProperties"][number]) => void;
  setFilter: (category: FilterCategory, values: string[]) => void;
  toggleFilterValue: (category: FilterCategory, value: string) => void;
  clearFilter: (category: FilterCategory) => void;
  clearAllFilters: () => void;
  reset: () => void;
}

interface CreateDataRendererStoreOptions {
  storageKey: string;
  initialState?: Partial<DataRendererSnapshot>;
}

const WORKSPACE_STORE_NAMESPACE = "pstdio/ui/tickets-workspace";

const toStorageName = (storageKey: string) => `${WORKSPACE_STORE_NAMESPACE}/${storageKey}`;

const DEFAULT_SNAPSHOT: DataRendererSnapshot = {
  settings: DEFAULT_DATA_RENDERER_SETTINGS,
  filters: {},
};

const createNoopStorage = () => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

export const createDataRendererStore = (options: CreateDataRendererStoreOptions) => {
  const { storageKey, initialState } = options;
  const snapshot = {
    settings: { ...DEFAULT_SNAPSHOT.settings, ...(initialState?.settings ?? {}) },
    filters: initialState?.filters ?? DEFAULT_SNAPSHOT.filters,
  };

  return createStore<DataRendererState>()(
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
        setDisplayProperties: (displayProperties) =>
          set((state) => ({
            ...state,
            settings: {
              ...state.settings,
              displayProperties,
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
            const nextFilters =
              nextValues.length === 0
                ? omitFilterCategory(state.filters, category)
                : { ...state.filters, [category]: nextValues };

            return { ...state, filters: nextFilters };
          }),
        clearFilter: (category) =>
          set((state) => {
            return {
              ...state,
              filters: omitFilterCategory(state.filters, category),
            };
          }),
        clearAllFilters: () => set((state) => ({ ...state, filters: {} })),
        reset: () => set(DEFAULT_SNAPSHOT),
      }),
      {
        name: toStorageName(storageKey),
        version: 1,
        migrate: (persisted, version) => {
          if (version === 0) {
            const state = persisted as DataRendererSnapshot;
            // Remove legacy "labels" filter category
            const filters = { ...state.filters };
            delete (filters as Record<string, unknown>).labels;

            // Remove legacy "labels" display property
            const displayProperties = state.settings.displayProperties.filter(
              (p) => p !== ("labels" as DisplayProperty),
            );

            return {
              ...state,
              settings: { ...state.settings, displayProperties },
              filters,
            };
          }
          return persisted as DataRendererSnapshot;
        },
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

const workspaceStoreRegistry = new Map<string, ReturnType<typeof createDataRendererStore>>();

export const getDataRendererStore = (storageKey: string) => {
  const existingStore = workspaceStoreRegistry.get(storageKey);
  if (existingStore) {
    return existingStore;
  }

  const store = createDataRendererStore({ storageKey });
  workspaceStoreRegistry.set(storageKey, store);

  return store;
};

export const useDataRendererStore = <T>(storageKey: string, selector: (state: DataRendererState) => T) => {
  const store = getDataRendererStore(storageKey);
  return useStore(store, selector);
};

export type { DataRendererState };
