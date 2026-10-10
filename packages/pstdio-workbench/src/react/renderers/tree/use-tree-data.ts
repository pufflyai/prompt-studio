import { resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getWorkbenchRenderers, type ResourceRef, type TreeNode, type WorkbenchCore } from "../../../core";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { useRendererRead } from "../use-renderer-read";
import { previewTreeResources } from "./tree-resource-preview";
import {
  expandDefaultTreeSections,
  type LoadedTreeData,
  loadExpandedTreeChildren,
  loadTreeData,
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
) => {
  const trees = getWorkbenchRenderers(workbench);
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  useWorkbenchStore(trees.treeStore, (state) => state.refreshKeysByTreeId[treeViewId]);
  const mode = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const location = useWorkbenchStore(workbench.pages.store, (state) => state.location);
  const project = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const activePage = useWorkbenchStore(workbench.pages.store, (state) => state.activePageId);
  const getPageOwner = () => (activePage ? workbench.navigationTrees.resolveOwner("page", activePage) : undefined);
  const pageOwner = useSyncExternalStore(
    (listener) => {
      const subscription = workbench.navigationTrees.onDidChange(listener);
      return () => subscription.dispose();
    },
    getPageOwner,
    getPageOwner,
  );
  // Navigation keeps mounted rows. A new search clears results that no longer match its query.
  const queryKey = JSON.stringify([treeViewId, viewId, project, filter]);
  const refreshKey = JSON.stringify(
    trees.getTreeRenderer(treeViewId)?.getReadKey?.({ resource, viewId, filter }) ?? [
      resourceKey(resource),
      resourceKey(location?.resource),
      mode,
      pageOwner,
    ],
  );
  const childrenKey = JSON.stringify([queryKey, refreshKey]);
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
      const ctx = { resource, viewId, filter, signal };
      const data = await loadTreeData(trees, treeViewId, ctx, (available) => publish({ ...available, children: {} }));
      signal.throwIfAborted();
      const children =
        data && trees.getTreeRenderer(treeViewId)
          ? await loadExpandedTreeChildren(trees, treeViewId, data, trees.getTreeState(treeViewId).expandedNodeIds, ctx)
          : {};
      return { header: data?.header ?? [], body: data?.body ?? [], footer: data?.footer ?? [], children };
    },
    subscribe: (refresh) =>
      trees.onDidRefresh((event) => {
        if (event.treeId === treeViewId) refresh();
      }),
  });
  // Expanding one folder loads only its children. The next full read already includes them.
  const loadChildren = (node: TreeNode) => {
    void trees.getChildren(treeViewId, node, { resource, viewId, filter }).then((children) => {
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
  const savedBody = read.value?.body ?? [];
  const savedChildren = {
    ...(expandedChildren.queryKey === childrenKey ? expandedChildren.byNodeId : {}),
    ...read.value?.children,
  };
  const renderer = trees.getTreeRenderer(treeViewId);
  const movement = useTreeMovement({
    scope: queryKey,
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
    header: read.value?.header ?? [],
    footer: read.value?.footer ?? [],
    loadChildren,
    error: read.error ?? null,
    loading: read.loading && !read.value,
    retry: read.retry,
  };
};
