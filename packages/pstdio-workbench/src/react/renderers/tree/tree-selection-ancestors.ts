import type { TreeNode, TreeViewSection } from "../../../core";

export const treeSelectionAncestors = (
  sections: TreeViewSection[],
  childrenByNodeId: Record<string, TreeNode[]>,
  selectedIds: string[],
) => {
  const selected = new Set(selectedIds);
  const parents = new Set<string>();
  const expandedSections = new Set<string>();
  const visit = (nodes: TreeNode[], path: string[], sectionId: string) => {
    for (const node of nodes) {
      if (selected.has(node.id)) {
        for (const id of path) parents.add(id);
        expandedSections.add(sectionId);
      }
      visit([...(node.children ?? []), ...(childrenByNodeId[node.id] ?? [])], [...path, node.id], sectionId);
    }
  };
  for (const section of sections) visit(section.nodes, [], section.id);
  if (!expandedSections.size) return undefined;
  return { nodes: [...parents], sections: [...expandedSections] };
};
