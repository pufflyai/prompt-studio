import { useEffect } from "react";
import type { WorkbenchPanelInstance } from "../../../core";
import { getWorkbenchRenderers, type ResourceRef, type TreeNode, type WorkbenchCore } from "../../../core";
import { reportUserActionError } from "../../../core/shared/run-user-action";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { useSharedEqualValue } from "../share-equal-value";
import { previewTreeResources } from "./tree-resource-preview";
import { expandDefaultTreeSections } from "./tree-view-load";
import { canMoveTreeNode, createMoveTreeNode } from "./tree-view-move";
import { useTreeMovement } from "./use-tree-movement";
import { useTreePages } from "./use-tree-pages";
import { useTreeRead } from "./use-tree-read";
import { useTreeResourceRefresh } from "./use-tree-resource-refresh";

// One empty map for every render: the adapter reads children from the nodes themselves.
const NO_CHILDREN: Record<string, TreeNode[]> = {};

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
  const {
    read,
    structure,
    queryKey,
    queryScope,
    refreshKey,
    childrenKey,
    changes,
    navigationRegistrations,
    pageParams,
  } = useTreeRead(workbench, treeViewId, resource, viewId, filter, ownerKey, placement);
  // Only the mounted renderer initializes expansion; presence observers share its finite read.
  useEffect(() => expandDefaultTreeSections(getWorkbenchRenderers(workbench), treeViewId), [workbench, treeViewId]);
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
