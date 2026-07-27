import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { createBrowserStorage } from "../../utils/browser-storage";
import { omitFilterCategory } from "./kanban-renderer-helpers";
import {
  applyKanbanRendererView,
  isKanbanRendererViewDirty,
  snapshotKanbanRendererView,
} from "./kanban-renderer-views";
import {
  DEFAULT_KANBAN_RENDERER_SETTINGS,
  type KanbanRendererFilterState,
  type KanbanRendererSavedView,
  type KanbanRendererSettings,
  MANUAL_ORDERING,
  NO_GROUPING,
} from "./types";

interface KanbanRendererSnapshot {
  settings: KanbanRendererSettings;
  filters: KanbanRendererFilterState;
  expandedGroups: Record<string, boolean>;
  views: KanbanRendererSavedView[];
  activeViewId: string;
}

interface KanbanRendererStoreInitialState {
  settings?: Partial<KanbanRendererSettings>;
  filters?: KanbanRendererFilterState;
  expandedGroups?: Record<string, boolean>;
  views?: KanbanRendererSavedView[];
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
  activateView: (viewId: string) => void;
  createView: (view: { id: string; title: string }) => void;
  saveActiveView: () => void;
  resetActiveView: () => void;
  renameView: (viewId: string, title: string) => void;
  duplicateView: (viewId: string, duplicate: { id: string; title: string }) => void;
  deleteView: (viewId: string) => void;
  setDefaultView: (viewId: string) => void;
  reset: () => void;
}

interface CreateKanbanRendererStoreOptions {
  storageKey: string;
  initialState?: KanbanRendererStoreInitialState;
}

const WORKSPACE_STORE_NAMESPACE = "pstdio/ui/kanban-renderer";

const toStorageName = (storageKey: string) => `${WORKSPACE_STORE_NAMESPACE}/${storageKey}`;

const DEFAULT_SNAPSHOT: KanbanRendererSnapshot = {
  settings: DEFAULT_KANBAN_RENDERER_SETTINGS,
  filters: {},
  expandedGroups: {},
  views: [],
  activeViewId: "default",
};

const createSnapshot = (initialState?: KanbanRendererStoreInitialState): KanbanRendererSnapshot => {
  const initialSettings = { ...DEFAULT_SNAPSHOT.settings, ...(initialState?.settings ?? {}) };
  const initialFilters = initialState?.filters ?? DEFAULT_SNAPSHOT.filters;
  const suppliedViews = initialState?.views ?? [];
  const views =
    suppliedViews.length > 0
      ? suppliedViews
      : [snapshotKanbanRendererView("default", "All", { settings: initialSettings, filters: initialFilters }, true)];
  const requestedView = views.find((view) => view.id === initialState?.activeViewId);
  const activeView = requestedView ?? views.find((view) => view.isDefault) ?? views[0]!;

  return {
    ...applyKanbanRendererView(activeView),
    expandedGroups: initialState?.expandedGroups ?? DEFAULT_SNAPSHOT.expandedGroups,
    views,
    activeViewId: activeView.id,
  };
};

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

// Strip the legacy "tag:" prefix used before attributes became first-class.
const stripTagPrefix = (id: string) => (id.startsWith("tag:") ? id.slice(4) : id);

const migrateSettings = (settings: Record<string, unknown>): KanbanRendererSettings => {
  const orderingRaw = settings.ordering as Record<string, unknown> | undefined;
  const orderingId =
    typeof orderingRaw?.attributeId === "string"
      ? (orderingRaw.attributeId as string)
      : typeof orderingRaw?.field === "string"
        ? stripTagPrefix(orderingRaw.field as string)
        : MANUAL_ORDERING;
  const orderingDirection = (
    orderingRaw?.direction === "desc" ? "desc" : "asc"
  ) as KanbanRendererSettings["ordering"]["direction"];

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

const migrateFilters = (filters: Record<string, unknown>): KanbanRendererFilterState => {
  const next: KanbanRendererFilterState = {};
  for (const [id, values] of Object.entries(filters)) {
    if (!Array.isArray(values)) continue;
    const stringValues = values.filter((value): value is string => typeof value === "string");
    if (stringValues.length === 0) continue;
    next[stripTagPrefix(id)] = stringValues;
  }
  return next;
};

export const createKanbanRendererStore = (options: CreateKanbanRendererStoreOptions) => {
  const { storageKey, initialState } = options;
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
        activateView: (viewId) =>
          set((state) => {
            const view = state.views.find((entry) => entry.id === viewId);
            return view
              ? { ...state, ...applyKanbanRendererView(view), activeViewId: view.id, expandedGroups: {} }
              : state;
          }),
        createView: (view) =>
          set((state) => {
            const savedView = snapshotKanbanRendererView(view.id, view.title, state);
            return { ...state, views: [...state.views, savedView], activeViewId: savedView.id };
          }),
        saveActiveView: () =>
          set((state) => ({
            ...state,
            views: state.views.map((view) =>
              view.id === state.activeViewId
                ? snapshotKanbanRendererView(view.id, view.title, state, view.isDefault)
                : view,
            ),
          })),
        resetActiveView: () =>
          set((state) => {
            const view = state.views.find((entry) => entry.id === state.activeViewId);
            return view ? { ...state, ...applyKanbanRendererView(view) } : state;
          }),
        renameView: (viewId, title) =>
          set((state) => ({
            ...state,
            views: state.views.map((view) => (view.id === viewId ? { ...view, title } : view)),
          })),
        duplicateView: (viewId, duplicate) =>
          set((state) => {
            const source = state.views.find((view) => view.id === viewId);
            if (!source) return state;
            const copy = snapshotKanbanRendererView(duplicate.id, duplicate.title, source);
            return {
              ...state,
              ...applyKanbanRendererView(copy),
              views: [...state.views, copy],
              activeViewId: copy.id,
              expandedGroups: {},
            };
          }),
        deleteView: (viewId) =>
          set((state) => {
            if (state.views.length === 1) return state;
            const views = state.views.filter((view) => view.id !== viewId);
            if (views.length === state.views.length || state.activeViewId !== viewId) return { ...state, views };
            const activeView = views.find((view) => view.isDefault) ?? views[0]!;
            return {
              ...state,
              ...applyKanbanRendererView(activeView),
              views,
              activeViewId: activeView.id,
              expandedGroups: {},
            };
          }),
        setDefaultView: (viewId) =>
          set((state) => ({
            ...state,
            views: state.views.map((view) => ({ ...view, isDefault: view.id === viewId || undefined })),
          })),
        reset: () => set(snapshot),
      }),
      {
        name: toStorageName(storageKey),
        version: 3,
        migrate: (persisted, version) => {
          if (!persisted || typeof persisted !== "object") return persisted as KanbanRendererSnapshot;
          const state = persisted as {
            settings?: Record<string, unknown>;
            filters?: Record<string, unknown>;
            expandedGroups?: Record<string, boolean>;
            views?: KanbanRendererSavedView[];
            activeViewId?: string;
          };
          if (version >= 3) {
            const snapshot = state as unknown as KanbanRendererSnapshot;
            return { ...snapshot, expandedGroups: {} };
          }
          const settings = migrateSettings(state.settings ?? {});
          const filters = migrateFilters(state.filters ?? {});
          return createSnapshot({ settings, filters });
        },
        storage: createJSONStorage(createBrowserStorage),
        partialize: (state) => ({
          settings: state.settings,
          filters: state.filters,
          views: state.views,
          activeViewId: state.activeViewId,
        }),
      },
    ),
  );
};

const workspaceStoreRegistry = new Map<string, ReturnType<typeof createKanbanRendererStore>>();

export const getKanbanRendererStore = (storageKey: string, initialState?: KanbanRendererStoreInitialState) => {
  const existingStore = workspaceStoreRegistry.get(storageKey);
  if (existingStore) return existingStore;

  const store = createKanbanRendererStore({ storageKey, initialState });
  workspaceStoreRegistry.set(storageKey, store);
  return store;
};

export const useKanbanRendererStore = <T>(
  storageKey: string,
  selector: (state: KanbanRendererState) => T,
  initialState?: KanbanRendererStoreInitialState,
) => {
  const store = getKanbanRendererStore(storageKey, initialState);
  return useStore(store, selector);
};

export const isActiveKanbanRendererViewDirty = (
  state: Pick<KanbanRendererState, "activeViewId" | "filters" | "settings" | "views">,
) =>
  isKanbanRendererViewDirty(
    state.views.find((view) => view.id === state.activeViewId),
    state,
  );

export type { KanbanRendererSnapshot, KanbanRendererState, KanbanRendererStoreInitialState };
