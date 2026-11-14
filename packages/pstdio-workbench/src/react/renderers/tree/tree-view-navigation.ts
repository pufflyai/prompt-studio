import {
  getWorkbenchRenderers,
  type NavigationTarget,
  type TreeNode,
  type TreeViewSection,
  type WorkbenchCore,
} from "../../../core";
import { findNodeInSections } from "./tree-list-adapter";

export const shouldSelectTreeNodeForNavigationTarget = (target: NavigationTarget) => {
  const items = target.kind === "compound" ? target.targets : [target];
  return items.some((item) => item.kind === "page" || item.kind === "panel");
};

export const createToggleTreeSection =
  (workbench: WorkbenchCore, treeViewId: string, expandedIds: string[]) => (sectionId: string) => {
    getWorkbenchRenderers(workbench).setSectionExpanded(treeViewId, sectionId, !expandedIds.includes(sectionId));
  };

interface ToggleTreeNodeContext {
  workbench: WorkbenchCore;
  treeViewId: string;
  body: TreeViewSection[];
  header: TreeViewSection[];
  footer: TreeViewSection[];
  childrenByNodeId: Record<string, TreeNode[]>;
  expandedNodeIds: string[];
  loadChildren(node: TreeNode): void;
}

export const createToggleTreeNode = (context: ToggleTreeNodeContext) => (nodeId: string) => {
  const node =
    findNodeInSections(context.body, nodeId, context.childrenByNodeId) ??
    findNodeInSections([...context.header, ...context.footer], nodeId, context.childrenByNodeId);
  if (!node) return;

  const expanded = context.expandedNodeIds.includes(nodeId);
  getWorkbenchRenderers(context.workbench).setNodeExpanded(context.treeViewId, nodeId, !expanded);
  if (expanded) return;

  context.loadChildren(node);
};
