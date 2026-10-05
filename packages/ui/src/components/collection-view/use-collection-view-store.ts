import type { ViewFilterGroup, ViewFilterRule, ViewSort } from "@pstdio/sdk/extensions";
import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  createHostPersistStorage,
  createHostStoreRegistry,
  type HostStorage,
  useHostStorage,
} from "../../utils/host-storage";
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
  /** Commits picker values; scalar values transfer editing to their bubble. */
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
  storage?: HostStorage;
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
            if (Array.isArray(rule.value) && rule.value.length === 0)
              return { filter: setRuleAt(current, index, undefined), openRuleIndex: null };
            const filter = index === -1 ? addRule(current, rule) : setRuleAt(current, index, rule);
            // Option lists keep their stable toolbar anchor while the selection changes.
            if (Array.isArray(rule.value) && state.openMenu === "filter") return { filter, openRuleIndex: null };
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
        storage: createHostPersistStorage(storage),
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

const hostCollectionViewStore = createHostStoreRegistry<
  AnyCollectionViewStore,
  [CollectionViewStoreInitialState<unknown>]
>((storageKey, storage, initialState) => createCollectionViewStore({ storageKey, initialState, storage }));

/** One store per host storage and key. The first caller's initial state wins. */
export const getCollectionViewStore = <TSettings>(
  storageKey: string,
  initialState: CollectionViewStoreInitialState<TSettings>,
  storage?: HostStorage,
) =>
  hostCollectionViewStore(storageKey, storage, initialState) as unknown as StoreApi<
    CollectionViewStoreState<TSettings>
  >;

export const useCollectionViewStore = <TSettings, T>(
  storageKey: string,
  initialState: CollectionViewStoreInitialState<TSettings>,
  selector: (state: CollectionViewStoreState<TSettings>) => T,
) => useStore(getCollectionViewStore(storageKey, initialState, useHostStorage()), selector);
