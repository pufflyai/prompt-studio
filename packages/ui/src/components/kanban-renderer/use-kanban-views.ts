import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useHostStorage } from "../../utils/host-storage";
import { isKanbanRendererViewDirty } from "./kanban-renderer-views";
import {
  DEFAULT_KANBAN_RENDERER_SETTINGS,
  type KanbanRendererFilterState,
  type KanbanRendererSavedView,
  type KanbanRendererSettings,
  type KanbanRendererViewsSource,
} from "./types";
import { getKanbanRendererStore } from "./use-kanban-renderer-store";

export interface KanbanViewsInput {
  storageKey: string;
  viewsSource?: KanbanRendererViewsSource;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilters?: KanbanRendererFilterState;
}
export const useKanbanViews = (input: KanbanViewsInput) => {
  const store = getKanbanRendererStore(input.storageKey, useHostStorage());
  const activeViewId = useStore(store, (state) => state.activeViewId);
  const defaults = input.defaultViews?.length
    ? input.defaultViews
    : [
        {
          id: "default",
          title: "All",
          settings: { ...DEFAULT_KANBAN_RENDERER_SETTINGS, ...input.defaultSettings },
          filters: input.defaultFilters ?? {},
        },
      ];
  const views = input.viewsSource?.views ?? defaults.map((view) => ({ ...view, builtIn: true }));
  const defaultId = [
    input.viewsSource?.defaultViewId,
    input.defaultActiveViewId,
    input.defaultViews?.find((view) => view.isDefault)?.id,
    views[0]?.id,
  ].find((id) => views.some((view) => view.id === id));
  const previous = useRef<{ views: KanbanRendererSavedView[]; active?: KanbanRendererSavedView }>(undefined);
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
      !isKanbanRendererViewDirty(prior.active, state) &&
      isKanbanRendererViewDirty(active, state)
    ) {
      state.activateView(active);
    }
    previous.current = { views, active };
  }, [store, views, defaultId, activeViewId]);
  return { views, defaultId };
};
