import type { TreeNode } from "@pstdio/sdk/extensions";
export const selectionAfterDelete = (selected: string | undefined, path: string) =>
  selected && selected !== path && !selected.startsWith(`${path}/`) ? selected : undefined;
/** Populate just the selected branch. The native tree then reveals its already-loaded ancestors. */
export const loadSelectedAncestors = async (
  nodes: TreeNode[],
  selected: string | undefined,
  load: (path: string) => Promise<TreeNode[]>,
): Promise<TreeNode[]> => {
  if (!selected) return nodes;
  return Promise.all(
    nodes.map(async (node) => {
      if (!node.collapsible || !selected.startsWith(`${node.id}/`)) return node;
      return { ...node, children: await loadSelectedAncestors(await load(node.id), selected, load) };
    }),
  );
};
