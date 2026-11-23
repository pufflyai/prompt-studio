import { type PageLocation, resourceKey } from "@pstdio/sdk/extensions";
import { type RefObject, useLayoutEffect, useSyncExternalStore } from "react";
import {
  getWorkbenchRenderers,
  type ResourceRef,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
} from "../../../core";
import { resourceNavigationStateScope } from "../../../core/controllers/page-location/navigation-tree-state-scope";
import { treeStateKey } from "../../../core/registries/renderers/tree-state-scope";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { useTreeNavigationState } from "./use-tree-navigation-state";

export const resourceTreeStateScope = (workbench: WorkbenchCore, location: PageLocation | undefined) =>
  resourceNavigationStateScope({
    projectId: workbench.pages.store.getState().projectId,
    location,
    pages: workbench.pages.listPages(),
    navigationTrees: workbench.navigationTrees,
  });
const empty = { filter: "", scrollTop: 0 };
const states = new WeakMap<WorkbenchCore, Map<string, typeof empty>>();
const listeners = new WeakMap<WorkbenchCore, Map<string, Set<() => void>>>();
// Keep live inputs and at most 128 recently visited inactive presentations.
const prunePresentations = (workbench: WorkbenchCore) => {
  const map = states.get(workbench);
  if (!map) return;
  const inactive = [...map.keys()].filter((key) => !listeners.get(workbench)?.get(key)?.size);
  for (const key of inactive.slice(0, Math.max(0, inactive.length - 128))) map.delete(key);
};
export const useTreePresentationState = (workbench: WorkbenchCore, key: string) => {
  const snapshot = useSyncExternalStore(
    (listener) => {
      let subscriptions = listeners.get(workbench);
      if (!subscriptions) {
        subscriptions = new Map();
        listeners.set(workbench, subscriptions);
      }
      let set = subscriptions.get(key);
      if (!set) {
        set = new Set();
        subscriptions.set(key, set);
      }
      set.add(listener);
      const map = states.get(workbench),
        previous = map?.get(key);
      if (map && previous) {
        map.delete(key);
        map.set(key, previous);
      }
      return () => {
        set.delete(listener);
        if (!set.size && subscriptions.get(key) === set) subscriptions.delete(key);
        // React may reattach this same live scope during the current commit.
        queueMicrotask(() => prunePresentations(workbench));
      };
    },
    () => states.get(workbench)?.get(key) ?? empty,
  );
  const update = (patch: Partial<typeof empty>) => {
    let map = states.get(workbench);
    if (!map) {
      map = new Map();
      states.set(workbench, map);
    }
    const previous = map.get(key) ?? empty;
    const next = { ...previous, ...patch };
    if (previous.filter === next.filter && previous.scrollTop === next.scrollTop) return;
    map.delete(key);
    map.set(key, next);
    prunePresentations(workbench);
    for (const listener of listeners.get(workbench)?.get(key) ?? []) listener();
  };
  return { ...snapshot, update };
};

export const useTreeViewState = (
  workbench: WorkbenchCore,
  treeViewId: string,
  resource: ResourceRef | undefined,
  placement: WorkbenchPanelInstance | undefined,
  isSidenav: boolean,
) => {
  "use no memo";
  const navigation = useTreeNavigationState(workbench, placement);
  const resourceMenu = workbench.viewMenus
    .listViewMenus()
    .some((menu) => menu.viewId === treeViewId && menu.purpose === "resources");
  const stateScope =
    (isSidenav || resourceMenu ? resourceTreeStateScope(workbench, navigation.activeLocation) : undefined) ??
    (resource ? JSON.stringify(["resource-tree", navigation.projectId, treeViewId, resourceKey(resource)]) : undefined);
  const presentationKey = stateScope ?? JSON.stringify([navigation.projectId, treeViewId]);
  const presentation = useTreePresentationState(workbench, presentationKey);
  const stateKey = treeStateKey(treeViewId, stateScope);
  const { treeStore } = getWorkbenchRenderers(workbench);
  const declared = useWorkbenchStore(treeStore, (state) => state.trees[treeViewId]);
  const fallback = {
    expandedNodeIds: declared?.defaultExpandedNodeIds ?? [],
    expandedSectionIds: declared?.defaultExpandedSectionIds ?? [],
  };
  const scopedState = useWorkbenchStore(treeStore, (state) => state.statesByTreeId[stateKey]) ?? fallback;
  // The host's loading flag applies to this tree regardless of its current resource scope.
  const loading = useWorkbenchStore(treeStore, (state) => state.statesByTreeId[treeViewId]?.loading);
  return { ...navigation, stateScope, presentationKey, presentation, treeState: { ...scopedState, loading } };
};
export const useTreeScrollRestoration = (
  scroll: RefObject<HTMLDivElement | null>,
  key: string,
  top: number,
  loading: boolean,
) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Restore on owner changes or after loading, never in response to the scroll being saved.
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = top;
  }, [scroll, key, loading]);
};
