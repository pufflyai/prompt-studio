import {
  createNavigationTreeRegistry,
  type NavigationTreeMoveContext,
} from "./registries/navigation/navigation-tree-registry";
import { pageTargetAvailable } from "./registries/pages/page-availability";
import type { TreeNode } from "./registries/renderers/tree-renderer-types";
import type { createCoreRenderers } from "./workbench-core-renderers";
import type { WorkbenchCore } from "./workbench-core-types";

export const createWorkbenchNavigationTrees = (
  renderers: ReturnType<typeof createCoreRenderers>,
  resolveCore?: () => WorkbenchCore | undefined,
) =>
  createNavigationTreeRegistry({
    isTargetAvailable: (target) => {
      const core = resolveCore?.();
      return !core || pageTargetAvailable(target, core.pages.listPages(), core.modes.getActiveModeId());
    },
    subscribeViewRefresh: (viewId, listener) =>
      renderers.onDidRefresh(({ treeId }) => {
        if (treeId === viewId) listener();
      }),
    getViewDefaultExpandedSectionIds: (viewId) => renderers.getTreeRenderer(viewId)?.defaultExpandedSectionIds,
    getViewSections: (viewId, context) => renderers.getBody(viewId, { ...context, viewId }),
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
