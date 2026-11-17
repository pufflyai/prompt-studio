import type { ScopedQueryClient } from "@pstdio/sdk/extensions";
import {
  createNavigationTreeRegistry,
  type NavigationTreeMoveContext,
} from "./registries/navigation/navigation-tree-registry";
import type { TreeNode } from "./registries/renderers/tree-renderer-types";
import type { createCoreRenderers } from "./workbench-core-renderers";

export const createWorkbenchNavigationTrees = (
  renderers: ReturnType<typeof createCoreRenderers>,
  queries?: ScopedQueryClient,
) =>
  createNavigationTreeRegistry({
    queries,
    subscribeViewRefresh: (viewId, listener) =>
      renderers.onDidRefresh((event) => {
        if (event.treeId === viewId) listener(event);
      }),
    getViewDefaultExpandedSectionIds: (viewId) => renderers.getTreeRenderer(viewId)?.defaultExpandedSectionIds,
    getViewDefaultExpandedNodeIds: (viewId) => renderers.getTreeRenderer(viewId)?.defaultExpandedNodeIds,
    getViewSections: (viewId, context) => renderers.getBody(viewId, { ...context, viewId }),
    getViewStructure: (viewId, context) =>
      renderers.getTreeRenderer(viewId)?.getStructure?.({ ...context, viewId }) ?? [],
    getViewChildren: (viewId, node, context) => renderers.getChildren(viewId, node, { ...context, viewId }),
    moveViewNode: (viewId, source, target, context) => moveNavigationNode(renderers, viewId, source, target, context),
  });

const moveNavigationNode = async (
  renderers: ReturnType<typeof createCoreRenderers>,
  viewId: string,
  source: TreeNode,
  target: TreeNode | undefined,
  context: NavigationTreeMoveContext,
) => {
  await renderers.getTreeRenderer(viewId)?.moveNode?.(source, target, {
    ...context,
    viewId,
    state: renderers.getTreeState(viewId),
    refresh: () => renderers.refresh(viewId),
    setSelectedNode: (nodeId) => renderers.setSelectedNode(viewId, nodeId),
  });
};
