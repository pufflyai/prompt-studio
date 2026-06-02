import type { TreeContext, TreeNode, TreeRendererRegistry, TreeViewSection } from "../../../core";

const isUnregisteredTreeError = (trees: TreeRendererRegistry, treeId: string, error: unknown) =>
  error instanceof Error &&
  error.message === `Tree renderer not registered: ${treeId}` &&
  !trees.getTreeRenderer(treeId);

export interface LoadedTreeData {
  body: TreeViewSection[];
  footer: TreeNode[];
}

// A tree reloads whenever the open resource changes (e.g. selecting a different
// sidebar item) or a refresh fires. Only show the loading state before a tree has
// produced any content; reloads keep the current content so the sidebar never
// blanks between selections.
export const shouldShowTreeLoading = (loadedTreeId: string | null, treeViewId: string) => loadedTreeId !== treeViewId;

export const loadTreeData = async (
  trees: TreeRendererRegistry,
  treeId: string,
  ctx: TreeContext = {},
): Promise<LoadedTreeData | null> => {
  if (!trees.getTreeRenderer(treeId)) return null;

  try {
    const [body, footer] = await Promise.all([trees.getBody(treeId, ctx), trees.getFooter(treeId, ctx)]);
    return { body, footer };
  } catch (error) {
    if (isUnregisteredTreeError(trees, treeId, error)) return null;
    throw error;
  }
};
