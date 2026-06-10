import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { createBrowserStorage } from "../../utils/browser-storage";
import { omitFilterCategory } from "./data-renderer-helpers";
import {
  type DataRendererFilterState,
  type DataRendererSettings,
  DEFAULT_DATA_RENDERER_SETTINGS,
  MANUAL_ORDERING,
  NO_GROUPING,
} from "./types";

interface DataRendererSnapshot {
  settings: DataRendererSettings;
  filters: DataRendererFilterState;
  expandedGroups: Record<string, boolean>;
}

interface DataRendererStoreInitialState {
  settings?: Partial<DataRendererSettings>;
  filters?: DataRendererFilterState;
  expandedGroups?: Record<string, boolean>;
}

interface DataRendererState extends DataRendererSnapshot {
  setViewMode: (viewMode: DataRendererSettings["viewMode"]) => void;
  setColumnGrouping: (columnGrouping: DataRendererSettings["columnGrouping"]) => void;
  setRowGrouping: (rowGrouping: DataRendererSettings["rowGrouping"]) => void;
  setOrdering: (ordering: DataRendererSettings["ordering"]) => void;
  setOrderingAttributeId: (attributeId: DataRendererSettings["ordering"]["attributeId"]) => void;
  setDisplayProperties: (displayProperties: string[]) => void;
  toggleSortDirection: () => void;
  toggleDisplayProperty: (property: string) => void;
  setFilter: (attributeId: string, values: string[]) => void;
  toggleFilterValue: (attributeId: string, value: string) => void;
  clearFilter: (attributeId: string) => void;
  clearAllFilters: () => void;
  setExpandedGroup: (groupId: string, isExpanded: boolean) => void;
  reset: () => void;
}

interface CreateDataRendererStoreOptions {
  storageKey: string;
  initialState?: DataRendererStoreInitialState;
}

const WORKSPACE_STORE_NAMESPACE = "pstdio/ui/data-renderer";

const toStorageName = (storageKey: string) => `${WORKSPACE_STORE_NAMESPACE}/${storageKey}`;

const DEFAULT_SNAPSHOT: DataRendererSnapshot = {
  settings: DEFAULT_DATA_RENDERER_SETTINGS,
  filters: {},
  expandedGroups: {},
};

const createSnapshot = (initialState?: DataRendererStoreInitialState): DataRendererSnapshot => ({
  settings: { ...DEFAULT_SNAPSHOT.settings, ...(initialState?.settings ?? {}) },
  filters: initialState?.filters ?? DEFAULT_SNAPSHOT.filters,
  expandedGroups: initialState?.expandedGroups ?? DEFAULT_SNAPSHOT.expandedGroups,
});

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

// Strip the legacy "tag:" prefix used before attributes became first-class.
const stripTagPrefix = (id: string) => (id.startsWith("tag:") ? id.slice(4) : id);

const migrateSettings = (settings: Record<string, unknown>): DataRendererSettings => {
  const orderingRaw = settings.ordering as Record<string, unknown> | undefined;
  const orderingId =
    typeof orderingRaw?.attributeId === "string"
      ? (orderingRaw.attributeId as string)
      : typeof orderingRaw?.field === "string"
        ? stripTagPrefix(orderingRaw.field as string)
        : MANUAL_ORDERING;
  const orderingDirection = (
    orderingRaw?.direction === "desc" ? "desc" : "asc"
  ) as DataRendererSettings["ordering"]["direction"];

  const columnGrouping =
    typeof settings.columnGrouping === "string" ? stripTagPrefix(settings.columnGrouping) : NO_GROUPING;
  const rowGrouping = typeof settings.rowGrouping === "string" ? stripTagPrefix(settings.rowGrouping) : NO_GROUPING;
  const displayProperties = Array.isArray(settings.displayProperties)
    ? (settings.displayProperties as unknown[])
        .filter((entry): entry is string => typeof entry === "string")
        .map(stripTagPrefix)
    : [];

  return {
    viewMode: settings.viewMode === "list" ? "list" : "board",
    columnGrouping,
    rowGrouping,
    ordering: { attributeId: orderingId === "manual" ? MANUAL_ORDERING : orderingId, direction: orderingDirection },
    displayProperties,
  };
};

const migrateFilters = (filters: Record<string, unknown>): DataRendererFilterState => {
  const next: DataRendererFilterState = {};
  for (const [id, values] of Object.entries(filters)) {
    if (!Array.isArray(values)) continue;
    const stringValues = values.filter((value): value is string => typeof value === "string");
    if (stringValues.length === 0) continue;
    next[stripTagPrefix(id)] = stringValues;
  }
  return next;
};

export const createDataRendererStore = (options: CreateDataRendererStoreOptions) => {
  const { storageKey, initialState } = options;
  const snapshot = createSnapshot(initialState);

  return createStore<DataRendererState>()(
    persist(
      (set) => ({
        ...snapshot,
        setViewMode: (viewMode) => set((state) => ({ ...state, settings: { ...state.settings, viewMode } })),
        setColumnGrouping: (columnGrouping) =>
          set((state) => ({ ...state, settings: { ...state.settings, columnGrouping } })),
        setRowGrouping: (rowGrouping) => set((state) => ({ ...state, settings: { ...state.settings, rowGrouping } })),
        setOrdering: (ordering) => set((state) => ({ ...state, settings: { ...state.settings, ordering } })),
        setOrderingAttributeId: (attributeId) =>
          set((state) => ({
            ...state,
            settings: { ...state.settings, ordering: { ...state.settings.ordering, attributeId } },
          })),
        setDisplayProperties: (displayProperties) =>
          set((state) => ({ ...state, settings: { ...state.settings, displayProperties } })),
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
            return { ...state, settings: { ...state.settings, displayProperties } };
          }),
        setFilter: (attributeId, values) =>
          set((state) => ({ ...state, filters: { ...state.filters, [attributeId]: values } })),
        toggleFilterValue: (attributeId, value) =>
          set((state) => {
            const currentValues = state.filters[attributeId] ?? [];
            const nextValues = toggleValue(currentValues, value);
            const nextFilters =
              nextValues.length === 0
                ? omitFilterCategory(state.filters, attributeId)
                : { ...state.filters, [attributeId]: nextValues };
            return { ...state, filters: nextFilters };
          }),
        clearFilter: (attributeId) =>
          set((state) => ({ ...state, filters: omitFilterCategory(state.filters, attributeId) })),
        clearAllFilters: () => set((state) => ({ ...state, filters: {} })),
        setExpandedGroup: (groupId, isExpanded) =>
          set((state) => ({ ...state, expandedGroups: { ...state.expandedGroups, [groupId]: isExpanded } })),
        reset: () => set(snapshot),
      }),
      {
        name: toStorageName(storageKey),
        version: 2,
        migrate: (persisted, version) => {
          if (!persisted || typeof persisted !== "object") return persisted as DataRendererSnapshot;
          const state = persisted as {
            settings?: Record<string, unknown>;
            filters?: Record<string, unknown>;
            expandedGroups?: Record<string, boolean>;
          };
          if (version >= 2) {
            const snapshot = state as unknown as DataRendererSnapshot;
            return { ...snapshot, expandedGroups: snapshot.expandedGroups ?? {} };
          }
          return {
            settings: migrateSettings(state.settings ?? {}),
            filters: migrateFilters(state.filters ?? {}),
            expandedGroups: {},
          };
        },
        storage: createJSONStorage(createBrowserStorage),
        partialize: (state) => ({
          settings: state.settings,
          filters: state.filters,
          expandedGroups: state.expandedGroups,
        }),
      },
    ),
  );
};

const workspaceStoreRegistry = new Map<string, ReturnType<typeof createDataRendererStore>>();

export const getDataRendererStore = (storageKey: string, initialState?: DataRendererStoreInitialState) => {
  const existingStore = workspaceStoreRegistry.get(storageKey);
  if (existingStore) return existingStore;

  const store = createDataRendererStore({ storageKey, initialState });
  workspaceStoreRegistry.set(storageKey, store);
  return store;
};

export const useDataRendererStore = <T>(
  storageKey: string,
  selector: (state: DataRendererState) => T,
  initialState?: DataRendererStoreInitialState,
) => {
  const store = getDataRendererStore(storageKey, initialState);
  return useStore(store, selector);
};

export type { DataRendererSnapshot, DataRendererState, DataRendererStoreInitialState };
