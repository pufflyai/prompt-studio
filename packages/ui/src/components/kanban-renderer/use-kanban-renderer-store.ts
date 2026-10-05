import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import {
  createHostPersistStorage,
  createHostStoreRegistry,
  type HostStorage,
  useHostStorage,
} from "../../utils/host-storage";
import { omitFilterCategory } from "./kanban-renderer-helpers";
import { applyKanbanRendererView } from "./kanban-renderer-views";
import {
  DEFAULT_KANBAN_RENDERER_SETTINGS,
  type KanbanRendererFilterState,
  type KanbanRendererSavedView,
  type KanbanRendererSettings,
} from "./types";

interface KanbanRendererSnapshot {
  settings: KanbanRendererSettings;
  filters: KanbanRendererFilterState;
  expandedGroups: Record<string, boolean>;
  activeViewId: string;
}

interface KanbanRendererStoreInitialState {
  settings?: Partial<KanbanRendererSettings>;
  filters?: KanbanRendererFilterState;
  expandedGroups?: Record<string, boolean>;
  activeViewId?: string;
}

interface KanbanRendererState extends KanbanRendererSnapshot {
  setViewMode: (viewMode: KanbanRendererSettings["viewMode"]) => void;
  setColumnGrouping: (columnGrouping: KanbanRendererSettings["columnGrouping"]) => void;
  setRowGrouping: (rowGrouping: KanbanRendererSettings["rowGrouping"]) => void;
  setOrdering: (ordering: KanbanRendererSettings["ordering"]) => void;
  setOrderingAttributeId: (attributeId: KanbanRendererSettings["ordering"]["attributeId"]) => void;
  setDisplayProperties: (displayProperties: string[]) => void;
  toggleSortDirection: () => void;
  toggleDisplayProperty: (property: string) => void;
  setFilter: (attributeId: string, values: string[]) => void;
  toggleFilterValue: (attributeId: string, value: string) => void;
  clearFilter: (attributeId: string) => void;
  clearAllFilters: () => void;
  setExpandedGroup: (groupId: string, isExpanded: boolean) => void;
  activateView: (view: KanbanRendererSavedView) => void;
  reset: () => void;
}

interface CreateKanbanRendererStoreOptions {
  storageKey: string;
  storage?: HostStorage;
  initialState?: KanbanRendererStoreInitialState;
}

const WORKSPACE_STORE_NAMESPACE = "pstdio/ui/kanban-renderer";

const toStorageName = (storageKey: string) => `${WORKSPACE_STORE_NAMESPACE}/${storageKey}`;

const DEFAULT_SNAPSHOT: KanbanRendererSnapshot = {
  settings: DEFAULT_KANBAN_RENDERER_SETTINGS,
  filters: {},
  expandedGroups: {},
  activeViewId: "",
};

const createSnapshot = (initialState?: KanbanRendererStoreInitialState): KanbanRendererSnapshot => ({
  settings: { ...DEFAULT_SNAPSHOT.settings, ...initialState?.settings },
  filters: initialState?.filters ?? {},
  activeViewId: initialState?.activeViewId ?? "",
  expandedGroups: initialState?.expandedGroups ?? {},
});
const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

export const createKanbanRendererStore = (options: CreateKanbanRendererStoreOptions) => {
  const { storageKey, initialState, storage } = options;
  const snapshot = createSnapshot(initialState);

  return createStore<KanbanRendererState>()(
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
        activateView: (view) => set({ ...applyKanbanRendererView(view), activeViewId: view.id, expandedGroups: {} }),
        reset: () => set(snapshot),
      }),
      {
        name: toStorageName(storageKey),
        version: 4,
        // Old local views have no shared owner. Start the new store from server defaults.
        migrate: () => snapshot,
        storage: createHostPersistStorage(storage),
        partialize: (state) => ({
          settings: state.settings,
          filters: state.filters,
          activeViewId: state.activeViewId,
          expandedGroups: state.expandedGroups,
        }),
      },
    ),
  );
};

export const getKanbanRendererStore = createHostStoreRegistry(
  (storageKey, storage, initialState?: KanbanRendererStoreInitialState) =>
    createKanbanRendererStore({ storageKey, initialState, storage }),
);

export const useKanbanRendererStore = <T>(
  storageKey: string,
  selector: (state: KanbanRendererState) => T,
  initialState?: KanbanRendererStoreInitialState,
) => {
  const store = getKanbanRendererStore(storageKey, useHostStorage(), initialState);
  return useStore(store, selector);
};

export type { KanbanRendererSnapshot, KanbanRendererState, KanbanRendererStoreInitialState };
