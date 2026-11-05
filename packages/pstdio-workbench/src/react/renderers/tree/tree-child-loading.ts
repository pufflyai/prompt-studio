import type { TreeNode, TreeQueryContext, TreeRendererRegistry, TreeViewSection } from "../../../core";
import { findNodeInSections } from "./tree-list-adapter";

export const loadTreeNodeChildren = async (
  trees: TreeRendererRegistry,
  treeId: string,
  node: TreeNode,
  context: TreeQueryContext,
  sections: TreeViewSection[],
  childrenByNodeId: Record<string, TreeNode[]> = {},
) => {
  // Optimistic moves can add partial children. Only provider data can complete a lazy read.
  const authoritative = findNodeInSections(sections, node.id, childrenByNodeId);
  return authoritative?.children ?? trees.getChildren(treeId, authoritative ?? node, context);
};
