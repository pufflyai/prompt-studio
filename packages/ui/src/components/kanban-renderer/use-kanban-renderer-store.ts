import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import { type CollectionViewStoreState, useCollectionViewStore } from "../collection-view/use-collection-view-store";
import { DEFAULT_KANBAN_RENDERER_SETTINGS, type KanbanRendererSettings } from "./types";

export type KanbanRendererState = CollectionViewStoreState<KanbanRendererSettings>;

export interface KanbanRendererStoreInitialState {
  settings?: Partial<KanbanRendererSettings>;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
}

export const kanbanRendererInitialState = (initialState?: KanbanRendererStoreInitialState) => ({
  settings: { ...DEFAULT_KANBAN_RENDERER_SETTINGS, ...initialState?.settings },
  filter: initialState?.filter,
  sorts: initialState?.sorts,
});

/** The unsaved view state of one board. Hosts read it to send the view to their query. */
export const useKanbanRendererStore = <T>(
  storageKey: string,
  selector: (state: KanbanRendererState) => T,
  initialState?: KanbanRendererStoreInitialState,
) => useCollectionViewStore(storageKey, kanbanRendererInitialState(initialState), selector);
