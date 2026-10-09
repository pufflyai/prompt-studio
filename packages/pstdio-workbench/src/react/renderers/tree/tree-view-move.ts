import type {
  RegisteredTreeRendererContribution,
  ResourceRef,
  TreeNode,
  TreeViewSection,
  WorkbenchCore,
} from "../../../core";
import { getWorkbenchRenderers } from "../../../core";
import { getNavigationTreeNodeSource } from "../../../core/registries/navigation/navigation-tree-node-source";
import { reportUserActionError } from "../../../core/shared/run-user-action";
import { findNodeInSections } from "./tree-list-adapter";

interface MoveTreeNodeContext {
  workbench: WorkbenchCore;
  renderer: RegisteredTreeRendererContribution;
  resource?: ResourceRef;
  viewId?: string;
  sections: TreeViewSection[];
  childrenByNodeId: Record<string, TreeNode[]>;
  onError?: (error: unknown) => void;
}

export const canMoveTreeNode = (
  context: Pick<MoveTreeNodeContext, "sections" | "childrenByNodeId">,
  sourceId: string,
  targetId?: string,
) => {
  const source = findNodeInSections(context.sections, sourceId, context.childrenByNodeId);
  const target = targetId ? findNodeInSections(context.sections, targetId, context.childrenByNodeId) : undefined;
  if (!source?.canDrag || sourceId === targetId || (targetId && !target?.canDrop)) return false;
  if (!target) return true;
  // Resource ownership is independent of the scope used for arranging navigation rows.
  const sourceOwner = getNavigationTreeNodeSource(source);
  const targetOwner = getNavigationTreeNodeSource(target);
  return (
    sourceOwner?.contribution === targetOwner?.contribution && sourceOwner?.registryToken === targetOwner?.registryToken
  );
};

export const createMoveTreeNode = (context: MoveTreeNodeContext) =>
  context.renderer.moveNode
    ? async (sourceNodeId: string, targetNodeId?: string, position?: "before" | "after" | "inside") => {
        const source = findNodeInSections(context.sections, sourceNodeId, context.childrenByNodeId);
        const target = targetNodeId
          ? (findNodeInSections(context.sections, targetNodeId, context.childrenByNodeId) ?? undefined)
          : undefined;
        if (!source || !canMoveTreeNode(context, sourceNodeId, targetNodeId)) return false;
        const trees = getWorkbenchRenderers(context.workbench);
        try {
          await context.renderer.moveNode?.(source, target, {
            resource: context.resource,
            viewId: context.viewId,
            position,
            state: trees.getTreeState(context.renderer.id),
            refresh: () => trees.refresh(context.renderer.id),
            setSelectedNode: (nodeId) => trees.setSelectedNode(context.renderer.id, nodeId),
          });
          return true;
        } catch (error) {
          if (context.onError) context.onError(error);
          else reportUserActionError(context.workbench, "Move", error);
          return false;
        }
      }
    : undefined;
