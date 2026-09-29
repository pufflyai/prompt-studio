import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { createBrowserStorage } from "../../utils/browser-storage";
import { omitFilterCategory } from "./kanban-renderer-helpers";
import { type KanbanRendererStorage, useKanbanRendererStorage } from "./kanban-renderer-storage";
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
  storage?: KanbanRendererStorage;
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
        storage: createJSONStorage(() =>
          storage
            ? {
                getItem: (key) => storage.getItem(key),
                setItem: (key, value) => storage.setItem(key, value),
                removeItem: (key) => storage.removeItem?.(key),
              }
            : createBrowserStorage(),
        ),
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

const hostStoreRegistries = new WeakMap<
  KanbanRendererStorage,
  Map<string, ReturnType<typeof createKanbanRendererStore>>
>();
const workspaceStoreRegistry = new Map<string, ReturnType<typeof createKanbanRendererStore>>();

export const getKanbanRendererStore = (
  storageKey: string,
  initialState?: KanbanRendererStoreInitialState,
  storage?: KanbanRendererStorage,
) => {
  let registry = storage ? hostStoreRegistries.get(storage) : workspaceStoreRegistry;
  if (!registry) {
    registry = new Map();
    hostStoreRegistries.set(storage!, registry);
  }
  const existingStore = registry.get(storageKey);
  if (existingStore) return existingStore;

  const store = createKanbanRendererStore({ storageKey, initialState, storage });
  registry.set(storageKey, store);
  return store;
};

export const useKanbanRendererStore = <T>(
  storageKey: string,
  selector: (state: KanbanRendererState) => T,
  initialState?: KanbanRendererStoreInitialState,
) => {
  const store = getKanbanRendererStore(storageKey, initialState, useKanbanRendererStorage());
  return useStore(store, selector);
};

export type { KanbanRendererSnapshot, KanbanRendererState, KanbanRendererStoreInitialState };
