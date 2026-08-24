import type {
  RegisteredTreeRendererContribution,
  ResourceRef,
  TreeNode,
  TreeViewSection,
  WorkbenchCore,
} from "../../../core";
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
    ? (sourceNodeId: string, targetNodeId?: string) => {
        const source = findNodeInSections(context.sections, sourceNodeId, context.childrenByNodeId);
        const target = targetNodeId
          ? (findNodeInSections(context.sections, targetNodeId, context.childrenByNodeId) ?? undefined)
          : undefined;
        if (!source || (targetNodeId && !target)) return;
        void Promise.resolve(
          context.renderer.moveNode?.(source, target, { resource: context.resource, viewId: context.viewId }),
        ).catch(context.onError);
      }
    : undefined;
