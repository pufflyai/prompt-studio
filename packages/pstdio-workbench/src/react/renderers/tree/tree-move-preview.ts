import type { TreeNode, TreeViewSection } from "../../../core";

export interface TreeMoveIntent {
  sourceId: string;
  targetId: string;
  position: "before" | "after" | "inside";
}

export const previewTreeMove = (
  sections: TreeViewSection[],
  children: Record<string, TreeNode[]>,
  move: TreeMoveIntent,
) => {
  const childrenOf = (node: TreeNode) => node.children ?? children[node.id];
  const find = (nodes: TreeNode[], id: string): TreeNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const child = find(childrenOf(node) ?? [], id);
      if (child) return child;
    }
  };
  const roots = sections.flatMap((section) => section.nodes);
  const source = find(roots, move.sourceId);
  const target = find(roots, move.targetId);
  if (!source?.canDrag || !target?.canDrop || source === target) return sections;
  if (find(childrenOf(source) ?? [], target.id)) return sections;
  if (move.position === "inside" && !childrenOf(target) && !target.collapsible) return sections;
  const materialize = (node: TreeNode): TreeNode => {
    const descendants = childrenOf(node);
    return descendants ? { ...node, children: descendants.map(materialize) } : node;
  };
  const moving = materialize(source);
  const update = (nodes: TreeNode[]): TreeNode[] =>
    nodes.flatMap((node) => {
      if (node.id === source.id) return [];
      const descendants = childrenOf(node);
      const next = descendants ? { ...node, children: update(descendants) } : node;
      if (node.id !== target.id) return [next];
      if (move.position === "inside") return [{ ...next, children: [...(next.children ?? []), moving] }];
      return move.position === "before" ? [moving, next] : [next, moving];
    });
  return sections.map((section) => ({ ...section, nodes: update(section.nodes) }));
};
