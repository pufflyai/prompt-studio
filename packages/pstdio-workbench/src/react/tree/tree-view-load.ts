import type { TreeNode, TreeRendererRegistry, TreeViewSection } from "../../core";

const isUnregisteredTreeError = (trees: TreeRendererRegistry, treeId: string, error: unknown) =>
  error instanceof Error &&
  error.message === `Tree renderer not registered: ${treeId}` &&
  !trees.getTreeRenderer(treeId);

export interface LoadedTreeData {
  body: TreeViewSection[];
  footer: TreeNode[];
}

export const loadTreeData = async (trees: TreeRendererRegistry, treeId: string): Promise<LoadedTreeData | null> => {
  if (!trees.getTreeRenderer(treeId)) return null;

  try {
    const [body, footer] = await Promise.all([trees.getBody(treeId), trees.getFooter(treeId)]);
    return { body, footer };
  } catch (error) {
    if (isUnregisteredTreeError(trees, treeId, error)) return null;
    throw error;
  }
};
