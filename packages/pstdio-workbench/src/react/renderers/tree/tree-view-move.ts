import type {
  RegisteredTreeRendererContribution,
  ResourceRef,
  TreeNode,
  TreeViewSection,
  WorkbenchCore,
} from "../../../core";
import { getWorkbenchRenderers } from "../../../core";
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

export const createMoveTreeNode = (context: MoveTreeNodeContext) =>
  context.renderer.moveNode
    ? async (sourceNodeId: string, targetNodeId?: string, position?: "before" | "after" | "inside") => {
        const source = findNodeInSections(context.sections, sourceNodeId, context.childrenByNodeId);
        const target = targetNodeId
          ? (findNodeInSections(context.sections, targetNodeId, context.childrenByNodeId) ?? undefined)
          : undefined;
        if (!source || (targetNodeId && !target)) return;
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
        } catch (error) {
          if (context.onError) context.onError(error);
          else reportUserActionError(context.workbench, "Move", error);
        }
      }
    : undefined;
