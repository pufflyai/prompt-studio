import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import {
  DEFAULT_WORKSPACE_SETTINGS,
  type DisplayProperty,
  type FilterCategory,
  type FilterState,
  type GroupingField,
  type WorkspaceSettings,
} from "./types";

interface WorkspaceSanitizationOptions {
  allowedDisplayProperties: DisplayProperty[];
  allowedFilterCategories: FilterCategory[];
  allowedGroupingFields: GroupingField[];
  defaultColumnGrouping: GroupingField;
  defaultRowGrouping: GroupingField;
}

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
  sanitize: (options: WorkspaceSanitizationOptions) => void;
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

const areArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const areFiltersEqual = (left: FilterState, right: FilterState) => {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  for (const [key, values] of leftEntries) {
    const otherValues = right[key as FilterCategory] ?? [];
    if (!areArraysEqual(values ?? [], otherValues)) {
      return false;
    }
  }

  return true;
};

const areSettingsEqual = (left: WorkspaceSettings, right: WorkspaceSettings) => {
  if (left.viewMode !== right.viewMode) return false;
  if (left.columnGrouping !== right.columnGrouping) return false;
  if (left.rowGrouping !== right.rowGrouping) return false;
  if (left.ordering.field !== right.ordering.field) return false;
  if (left.ordering.direction !== right.ordering.direction) return false;

  return areArraysEqual(left.displayProperties, right.displayProperties);
};

const sanitizeSnapshot = (snapshot: WorkspaceSnapshot, options: WorkspaceSanitizationOptions) => {
  const allowedDisplayProperties = new Set(options.allowedDisplayProperties);
  const allowedFilterCategories = new Set(options.allowedFilterCategories);
  const allowedGroupingFields = new Set(options.allowedGroupingFields);

  const displayProperties = snapshot.settings.displayProperties.filter((value) => allowedDisplayProperties.has(value));

  const filters = Object.fromEntries(
    Object.entries(snapshot.filters).filter(([key, values]) => {
      if (!allowedFilterCategories.has(key as FilterCategory)) {
        return false;
      }

      return Array.isArray(values) && values.length > 0;
    }),
  ) as FilterState;

  const columnGrouping = allowedGroupingFields.has(snapshot.settings.columnGrouping)
    ? snapshot.settings.columnGrouping
    : options.defaultColumnGrouping;

  const rowGrouping = allowedGroupingFields.has(snapshot.settings.rowGrouping)
    ? snapshot.settings.rowGrouping
    : options.defaultRowGrouping;

  return {
    settings: {
      ...snapshot.settings,
      columnGrouping,
      rowGrouping,
      displayProperties,
    },
    filters,
  };
};

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
        sanitize: (options) =>
          set((state) => {
            const nextSnapshot = sanitizeSnapshot(
              {
                settings: state.settings,
                filters: state.filters,
              },
              options,
            );

            if (
              areSettingsEqual(state.settings, nextSnapshot.settings) &&
              areFiltersEqual(state.filters, nextSnapshot.filters)
            ) {
              return state;
            }

            return {
              ...state,
              ...nextSnapshot,
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
