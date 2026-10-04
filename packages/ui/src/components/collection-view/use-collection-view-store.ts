import type { ViewFilterGroup, ViewFilterRule, ViewSort } from "@pstdio/sdk/extensions";
import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";
import { createBrowserStorage } from "../../utils/browser-storage";
import { type KanbanRendererStorage, useKanbanRendererStorage } from "../kanban-renderer/kanban-renderer-storage";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { normalFilter } from "./advanced-filter";
import { addRule, newRule, setRuleAt } from "./collection-view-rules";
import { type CollectionSavedView, EMPTY_VIEW_FILTER } from "./collection-view-types";

/** The unsaved state of one renderer: the active view and the edits made on top of it. */
export interface CollectionViewSnapshot<TSettings> {
  settings: TSettings;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
  expandedGroups: Record<string, boolean>;
  activeViewId: string;
}

export type CollectionViewMenu = "filter";

export interface CollectionViewStoreInitialState<TSettings> {
  settings: TSettings;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
}

export interface CollectionViewStoreState<TSettings> extends CollectionViewSnapshot<TSettings> {
  /** The view bar menu that is open. Screen state: never persisted. */
  openMenu: CollectionViewMenu | null;
  /** The root rule whose pill editor is open. Screen state: never persisted. */
  openRuleIndex: number | null;
  setOpenMenu: (menu: CollectionViewMenu | null) => void;
  setOpenRuleIndex: (index: number | null) => void;
  /** Adds a rule for the field and opens its pill editor. */
  startRule: (field: AttributeDescriptor) => void;
  /** Commits a picker selection and transfers editing to its bubble. */
  selectRule: (rule: ViewFilterRule) => void;
  setSettings: (settings: Partial<TSettings>) => void;
  setFilter: (filter: ViewFilterGroup) => void;
  setSorts: (sorts: ViewSort[]) => void;
  setExpandedGroup: (groupId: string, isExpanded: boolean) => void;
  activateView: (view: CollectionSavedView<TSettings>) => void;
  reset: () => void;
}

interface CreateCollectionViewStoreOptions<TSettings> {
  storageKey: string;
  storage?: KanbanRendererStorage;
  initialState: CollectionViewStoreInitialState<TSettings>;
}

const STORE_NAMESPACE = "pstdio/ui/kanban-renderer";

export const createCollectionViewStore = <TSettings>(options: CreateCollectionViewStoreOptions<TSettings>) => {
  const { storageKey, initialState, storage } = options;
  const snapshot: CollectionViewSnapshot<TSettings> = {
    settings: initialState.settings,
    filter: initialState.filter ?? EMPTY_VIEW_FILTER,
    sorts: (initialState.sorts ?? []).slice(0, 1),
    expandedGroups: {},
    activeViewId: "",
  };

  return createStore<CollectionViewStoreState<TSettings>>()(
    persist(
      (set) => ({
        ...snapshot,
        openMenu: null,
        openRuleIndex: null,
        // Opening one menu closes the other; closing one leaves the other alone.
        setOpenMenu: (openMenu) => set(openMenu ? { openMenu, openRuleIndex: null } : { openMenu }),
        setOpenRuleIndex: (openRuleIndex) =>
          set(openRuleIndex === null ? { openRuleIndex } : { openRuleIndex, openMenu: null }),
        startRule: (field) =>
          set((state) => {
            const current = normalFilter(state.filter);
            const index = current.rules.findIndex((rule) => rule.attributeId === field.id);
            if (index !== -1) return { filter: current, openMenu: null, openRuleIndex: index };
            const filter = addRule(current, newRule(field));
            return { filter, openMenu: null, openRuleIndex: filter.rules.length - 1 };
          }),
        selectRule: (rule) =>
          set((state) => {
            const current = normalFilter(state.filter);
            const index = current.rules.findIndex((entry) => entry.attributeId === rule.attributeId);
            const filter = index === -1 ? addRule(current, rule) : setRuleAt(current, index, rule);
            return { filter, openMenu: null, openRuleIndex: index === -1 ? filter.rules.length - 1 : index };
          }),
        setSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
        setFilter: (filter) => set({ filter }),
        setSorts: (sorts) => set({ sorts: sorts.slice(0, 1) }),
        setExpandedGroup: (groupId, isExpanded) =>
          set((state) => ({ expandedGroups: { ...state.expandedGroups, [groupId]: isExpanded } })),
        activateView: (view) =>
          set({
            settings: structuredClone(view.settings),
            filter: structuredClone(view.filter),
            sorts: structuredClone(view.sorts.slice(0, 1)),
            activeViewId: view.id,
            expandedGroups: {},
            openRuleIndex: null,
          }),
        reset: () => set(snapshot),
      }),
      {
        name: `${STORE_NAMESPACE}/${storageKey}`,
        version: 5,
        // Older local state used the single-value filter map and one ordering. Start from the server's views.
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
        merge: (persisted, current) => {
          const restored = { ...current, ...(persisted as Partial<CollectionViewSnapshot<TSettings>>) };
          return { ...restored, sorts: restored.sorts.slice(0, 1) };
        },
        partialize: (state) => ({
          settings: state.settings,
          filter: state.filter,
          sorts: state.sorts,
          activeViewId: state.activeViewId,
          expandedGroups: state.expandedGroups,
        }),
      },
    ),
  );
};

type AnyCollectionViewStore = StoreApi<CollectionViewStoreState<unknown>>;

const hostStoreRegistries = new WeakMap<KanbanRendererStorage, Map<string, AnyCollectionViewStore>>();
const browserStoreRegistry = new Map<string, AnyCollectionViewStore>();

/** One store per host storage and key. The first caller's initial state wins. */
export const getCollectionViewStore = <TSettings>(
  storageKey: string,
  initialState: CollectionViewStoreInitialState<TSettings>,
  storage?: KanbanRendererStorage,
) => {
  let registry = storage ? hostStoreRegistries.get(storage) : browserStoreRegistry;
  if (!registry) {
    registry = new Map();
    hostStoreRegistries.set(storage!, registry);
  }
  const existing = registry.get(storageKey);
  if (existing) return existing as unknown as StoreApi<CollectionViewStoreState<TSettings>>;
  const store = createCollectionViewStore({ storageKey, initialState, storage });
  registry.set(storageKey, store as unknown as AnyCollectionViewStore);
  return store;
};

export const useCollectionViewStore = <TSettings, T>(
  storageKey: string,
  initialState: CollectionViewStoreInitialState<TSettings>,
  selector: (state: CollectionViewStoreState<TSettings>) => T,
) => useStore(getCollectionViewStore(storageKey, initialState, useKanbanRendererStorage()), selector);
