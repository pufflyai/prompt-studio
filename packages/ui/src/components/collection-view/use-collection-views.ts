import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useKanbanRendererStorage } from "../kanban-renderer/kanban-renderer-storage";
import { isFilterGroup } from "./collection-view-filter";
import {
  type CollectionSavedView,
  type CollectionViewState,
  type CollectionViewsSource,
  EMPTY_VIEW_FILTER,
} from "./collection-view-types";
import { type CollectionViewStoreInitialState, getCollectionViewStore } from "./use-collection-view-store";

// The order of these lists does not change what the view shows.
const UNORDERED_SETTINGS = new Set(["displayProperties", "hiddenColumns"]);

const comparableSettings = (settings: unknown) =>
  Object.entries(settings as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, UNORDERED_SETTINGS.has(key) && Array.isArray(value) ? [...value].sort() : value]);

const comparableFilter = (filter: ViewFilterGroup): unknown => ({
  conjunction: filter.conjunction,
  rules: filter.rules.map((rule) =>
    isFilterGroup(rule)
      ? comparableFilter(rule)
      : {
          attributeId: rule.attributeId,
          condition: rule.condition,
          value: Array.isArray(rule.value) ? [...rule.value].sort() : rule.value,
        },
  ),
});

/** Search never counts: it is screen state, so it never marks a view as changed. */
export const isCollectionViewDirty = <TSettings>(
  view: CollectionSavedView<TSettings> | undefined,
  state: CollectionViewState<TSettings>,
) => {
  if (!view) return false;
  const comparable = (value: CollectionViewState<TSettings>) =>
    JSON.stringify([comparableSettings(value.settings), comparableFilter(value.filter), value.sorts]);
  return comparable(view) !== comparable(state);
};

export interface CollectionViewsInput<TSettings> {
  storageKey: string;
  initialState: CollectionViewStoreInitialState<TSettings>;
  viewsSource?: CollectionViewsSource<TSettings>;
  defaultViews?: CollectionSavedView<TSettings>[];
  defaultActiveViewId?: string;
}

/** Picks the views a renderer offers and keeps the store on a view that still exists. */
export const useCollectionViews = <TSettings>(input: CollectionViewsInput<TSettings>) => {
  const store = getCollectionViewStore(input.storageKey, input.initialState, useKanbanRendererStorage());
  const activeViewId = useStore(store, (state) => state.activeViewId);
  const { settings, filter = EMPTY_VIEW_FILTER, sorts = [] } = input.initialState;
  const defaults = input.defaultViews?.length
    ? input.defaultViews
    : [{ id: "default", title: "All", settings, filter, sorts }];
  const views = input.viewsSource?.views ?? defaults.map((view) => ({ ...view, builtIn: true }));
  const defaultId = [
    input.viewsSource?.defaultViewId,
    input.defaultActiveViewId,
    input.defaultViews?.find((view) => view.isDefault)?.id,
    views[0]?.id,
  ].find((id) => views.some((view) => view.id === id));
  const previous = useRef<{ views: CollectionSavedView<TSettings>[]; active?: CollectionSavedView<TSettings> }>(
    undefined,
  );
  useEffect(() => {
    const state = store.getState();
    const active = views.find((view) => view.id === activeViewId);
    const prior = previous.current;
    if (!active) {
      // A create response can select its view before the sync event arrives.
      // Only replace missing selections on mount or when a known view was deleted.
      if (!prior || !activeViewId || prior.views.some((view) => view.id === activeViewId)) {
        const fallback = views.find((view) => view.id === defaultId) ?? views[0];
        if (fallback) state.activateView(fallback);
      }
    } else if (
      prior?.active?.id === active.id &&
      !isCollectionViewDirty(prior.active, state) &&
      isCollectionViewDirty(active, state)
    ) {
      // Another client saved the view this person has open without edits: follow it.
      state.activateView(active);
    }
    previous.current = { views, active };
  }, [store, views, defaultId, activeViewId]);
  return { views, defaultId };
};
