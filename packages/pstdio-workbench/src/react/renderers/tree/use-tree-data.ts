import { resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useSyncExternalStore } from "react";
import type { WorkbenchPanelInstance } from "../../../core";
import { getWorkbenchRenderers, type ResourceRef, type TreeNode, type WorkbenchCore } from "../../../core";
import { resolveNavigationLevels } from "../../../core/controllers/page-location/navigation-level";
import { reportUserActionError } from "../../../core/shared/run-user-action";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { useSharedEqualValue } from "../share-equal-value";
import { usePageParams } from "../use-page-params";
import { useRendererRead } from "../use-renderer-read";
import { previewTreeResources } from "./tree-resource-preview";
import {
  expandDefaultTreeSections,
  type LoadedTreeData,
  loadExpandedTreeChildren,
  loadTreeData,
  treeStructure,
} from "./tree-view-load";
import { canMoveTreeNode, createMoveTreeNode } from "./tree-view-move";
import { useTreeMovement } from "./use-tree-movement";
import { useTreePages } from "./use-tree-pages";
import { useTreeResourceRefresh } from "./use-tree-resource-refresh";

// One empty map for every render: the adapter reads children from the nodes themselves.
const NO_CHILDREN: Record<string, TreeNode[]> = {};

const treeQueryScope = (workbench: WorkbenchCore, id: string, projectId: string | undefined) =>
  getWorkbenchRenderers(workbench).getTreeRenderer(id)?.queryScope ?? { projectId };

export const useTreeData = (
  workbench: WorkbenchCore,
  treeViewId: string,
  resource?: ResourceRef,
  viewId?: string,
  filter?: string,
  ownerKey = JSON.stringify(["tree", treeViewId, viewId]),
  onMoveError?: (error: unknown) => void,
  placement?: WorkbenchPanelInstance,
) => {
  const pageParams = usePageParams(workbench, placement);
  // Look the renderers up where they are used: React Compiler treats a held call result as mutable until its
  // last use, and cannot cache anything whose inputs stay mutable across the hooks below.
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  useWorkbenchStore(getWorkbenchRenderers(workbench).treeStore, (state) => state.refreshKeysByTreeId[treeViewId]);
  const mode = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const location = useWorkbenchStore(workbench.pages.store, (state) => state.location);
  const project = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const getPageOwner = () =>
    JSON.stringify(
      resolveNavigationLevels({
        location,
        pages: Object.values(workbench.pages.store.getState().pages),
        navigationTrees: workbench.navigationTrees,
      }).map(({ owner, location }) => [owner, resourceKey(location.resource)]),
    );
  const navigationRegistrations = useSyncExternalStore(
    (listener) => {
      const subscription = workbench.navigationTrees.onDidChange(listener);
      return () => subscription.dispose();
    },
    () => workbench.navigationTrees.getRegistrationRevision(),
    () => workbench.navigationTrees.getRegistrationRevision(),
  );
  const pageOwner = useSyncExternalStore(
    (listener) => {
      const subscription = workbench.navigationTrees.onDidChange(listener);
      return () => subscription.dispose();
    },
    getPageOwner,
    getPageOwner,
  );
  // A new owner or bound resource starts with its structure. Selecting a child page
  // refreshes the same owner's data without removing its mounted rows.
  const scope = getWorkbenchRenderers(workbench)
    .getTreeRenderer(treeViewId)
    ?.getReadKey?.({ resource, viewId, filter, pageParams });
  const queryScope = treeQueryScope(workbench, treeViewId, resource?.projectId ?? project);
  const refreshKey = JSON.stringify(scope ?? [resourceKey(resource), resourceKey(location?.resource), mode, pageOwner]);
  const queryKey = JSON.stringify([
    treeViewId,
    viewId,
    project,
    resourceKey(resource),
    filter,
    pageParams,
    mode,
    pageOwner,
  ]);
  const childrenKey = JSON.stringify([queryKey, refreshKey]);
  // A renderer's structure can read workbench state beyond its context, such as the navigation level. The read
  // keys capture that state, so the structure is read again whenever they change.
  const readStructure = (_readKey: string) =>
    treeStructure(getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId), {
      resource,
      viewId,
      filter,
      pageParams,
    });
  const structure = readStructure(childrenKey);

  // Defaults apply when the view starts. Refreshes keep sections the user collapsed.
  useEffect(() => expandDefaultTreeSections(getWorkbenchRenderers(workbench), treeViewId), [workbench, treeViewId]);
  const read = useRendererRead<LoadedTreeData & { children: Record<string, TreeNode[]> }>({
    workbench,
    ownerKey,
    sourceId: treeViewId,
    queryScope,
    queryEvents: getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId)?.queryEvents,
    queryKey,
    refreshKey,
    subscribe: getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId)?.subscribe
      ? (invalidate) =>
          getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId)!.subscribe!(
            { resource, viewId, filter, pageParams },
            invalidate,
          )
      : undefined,
    load: async (signal, publish) => {
      const ctx = { resource, viewId, filter, signal, pageParams };
      const trees = getWorkbenchRenderers(workbench);
      const data = await loadTreeData(trees, treeViewId, ctx, (available) => publish({ ...available, children: {} }));
      signal.throwIfAborted();
      const children =
        data && trees.getTreeRenderer(treeViewId)
          ? await loadExpandedTreeChildren(trees, treeViewId, data, trees.getTreeState(treeViewId).expandedNodeIds, ctx)
          : {};
      return {
        header: data?.header ?? [],
        body: data?.body ?? [],
        footer: data?.footer ?? [],
        children,
      };
    },
  });
  const loaded = {
    body: read.loading && !read.value?.body.length ? structure.body : (read.value?.body ?? []),
    header: read.value?.header ?? structure.header,
    footer: read.value?.footer ?? structure.footer,
    children: read.value?.children ?? {},
  };
  // The renderer's structure, cached reads, and each load step return new objects even when nothing changed.
  // Parts equal to the tree on screen keep their objects, so React Compiler skips the rows whose data did not
  // change instead of rebuilding every row on each step.
  // Rows keep the objects their renderer registered sources for, so a re-registered renderer or navigation
  // contribution starts over, like a new query.
  const tree = useSharedEqualValue(loaded, [
    queryKey,
    getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId),
    navigationRegistrations,
  ]);
  const pages = useTreePages(
    workbench,
    {
      queryScope,
      sourceId: treeViewId,
      queryKey: JSON.stringify([queryKey, refreshKey]),
      queryEvents: getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId)?.queryEvents,
    },
    queryKey,
    tree,
    read.value,
    read.loading,
    getWorkbenchRenderers(workbench).getTreeState(treeViewId),
  );
  const loadChildren = (id: string, retry = true) => {
    void pages
      .loadChildren(
        id,
        (current, signal) =>
          getWorkbenchRenderers(workbench).getChildren(treeViewId, current, {
            resource,
            viewId,
            filter,
            pageParams,
            signal,
          }),
        retry,
      )
      .catch((error) => reportUserActionError(workbench, "Load folder", error));
  };
  const treeState = useWorkbenchStore(
    getWorkbenchRenderers(workbench).treeStore,
    (state) => state.statesByTreeId[treeViewId],
  );
  useEffect(() => {
    for (const id of treeState?.expandedNodeIds ?? []) loadChildren(id, false);
  });
  useTreeResourceRefresh(workbench, pages, read.retry);
  const renderer = getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId);
  const movement = useTreeMovement({
    scope: childrenKey,
    body: pages.body,
    revision: read.request,
    childrenByNodeId: NO_CHILDREN,
    canMove: (sourceId, targetId) =>
      canMoveTreeNode({ sections: pages.body, childrenByNodeId: NO_CHILDREN }, sourceId, targetId),
    persist: renderer
      ? createMoveTreeNode({
          workbench,
          renderer,
          resource,
          viewId,
          sections: pages.body,
          childrenByNodeId: NO_CHILDREN,
          onError: onMoveError,
        })
      : undefined,
    refresh: read.retry,
  });
  return {
    ...movement,
    body: previewTreeResources(movement.body, movement.childrenByNodeId, changes),
    header: pages.header,
    footer: pages.footer,
    childrenByNodeId: NO_CHILDREN,
    loadChildren: (node: TreeNode) => loadChildren(node.id),
    error: read.error ?? null,
    loading: read.loading,
    retry: read.retry,
  };
};
