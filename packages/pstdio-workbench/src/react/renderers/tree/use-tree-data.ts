import { resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { WorkbenchPanelInstance } from "../../../core";
import { getWorkbenchRenderers, type ResourceRef, type TreeNode, type WorkbenchCore } from "../../../core";
import { resolveNavigationLevels } from "../../../core/controllers/page-location/navigation-level";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
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
  const trees = getWorkbenchRenderers(workbench);
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  useWorkbenchStore(trees.treeStore, (state) => state.refreshKeysByTreeId[treeViewId]);
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
  const scope = trees.getTreeRenderer(treeViewId)?.getReadKey?.({ resource, viewId, filter, pageParams });
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
  const renderer = trees.getTreeRenderer(treeViewId);
  const structure = treeStructure(renderer, { resource, viewId, filter, pageParams });
  // Defaults apply when the view starts. Refreshes keep sections the user collapsed.
  useEffect(() => expandDefaultTreeSections(getWorkbenchRenderers(workbench), treeViewId), [workbench, treeViewId]);
  const [expandedChildren, setExpandedChildren] = useState<{ queryKey: string; byNodeId: Record<string, TreeNode[]> }>({
    queryKey: childrenKey,
    byNodeId: {},
  });
  const read = useRendererRead<LoadedTreeData & { children: Record<string, TreeNode[]> }>({
    workbench,
    ownerKey,
    queryKey,
    refreshKey,
    load: async (signal, publish) => {
      const ctx = { resource, viewId, filter, signal, pageParams };
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
    subscribe: (refresh) =>
      trees.onDidRefresh((event) => {
        if (event.treeId === treeViewId) refresh();
      }),
  });
  // Expanding one folder loads only its children. The next full read already includes them.
  const loadChildren = (node: TreeNode) => {
    void trees.getChildren(treeViewId, node, { resource, viewId, filter, pageParams }).then((children) => {
      setExpandedChildren((current) => ({
        queryKey: childrenKey,
        byNodeId: { ...(current.queryKey === childrenKey ? current.byNodeId : {}), [node.id]: children },
      }));
    });
  };
  useEffect(() => {
    const subscription = workbench.resources.preview.subscribeRefresh(async (resource) => {
      const contains = (nodes: TreeNode[]): boolean =>
        nodes.some(
          (node) =>
            (node.resource && resourceKey(node.resource) === resourceKey(resource)) ||
            contains(read.value?.children[node.id] ?? node.children ?? []),
        );
      if (read.value?.body.some((section) => contains(section.nodes))) await read.retry();
    });
    return () => subscription.dispose();
  }, [workbench, read.retry, read.value]);
  const savedBody = read.loading && !read.value?.body.length ? structure.body : (read.value?.body ?? []);
  const savedChildren = {
    ...(expandedChildren.queryKey === childrenKey ? expandedChildren.byNodeId : {}),
    ...read.value?.children,
  };
  const movement = useTreeMovement({
    scope: childrenKey,
    body: savedBody,
    childrenByNodeId: savedChildren,
    canMove: (sourceId, targetId) =>
      canMoveTreeNode({ sections: savedBody, childrenByNodeId: savedChildren }, sourceId, targetId),
    persist: renderer
      ? createMoveTreeNode({
          workbench,
          renderer,
          resource,
          viewId,
          sections: savedBody,
          childrenByNodeId: savedChildren,
          onError: onMoveError,
        })
      : undefined,
    refresh: read.retry,
  });
  return {
    ...movement,
    body: previewTreeResources(movement.body, movement.childrenByNodeId, changes),
    childrenByNodeId: {},
    header: read.value?.header ?? structure.header,
    footer: read.value?.footer ?? structure.footer,
    loadChildren,
    error: read.error ?? null,
    loading: read.loading,
    retry: read.retry,
  };
};
