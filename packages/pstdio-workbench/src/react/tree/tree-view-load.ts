import type { TreeViewRegistry, TreeViewSection } from "../../core";

const isUnregisteredTreeViewError = (trees: TreeViewRegistry, treeViewId: string, error: unknown) =>
  error instanceof Error &&
  error.message === `Tree view not registered: ${treeViewId}` &&
  !trees.getTreeView(treeViewId);

export const loadTreeSections = async (
  trees: TreeViewRegistry,
  treeViewId: string,
): Promise<TreeViewSection[] | null> => {
  if (!trees.getTreeView(treeViewId)) return null;

  try {
    return await trees.getSections(treeViewId);
  } catch (error) {
    if (isUnregisteredTreeViewError(trees, treeViewId, error)) return null;
    throw error;
  }
};
