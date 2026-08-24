import type { TreeContext, TreeNode, TreeRendererRegistry, TreeViewSection } from "../../../core";

const isUnregisteredTreeError = (trees: TreeRendererRegistry, treeId: string, error: unknown) =>
  error instanceof Error &&
  error.message === `Tree renderer not registered: ${treeId}` &&
  !trees.getTreeRenderer(treeId);

export interface LoadedTreeData {
  header: TreeNode[];
  body: TreeViewSection[];
  footer: TreeNode[];
}

const listTreeNodes = (data: LoadedTreeData) => [
  ...data.header,
  ...data.body.flatMap((section) => section.nodes),
  ...data.footer,
];

export const loadExpandedTreeChildren = async (
  trees: TreeRendererRegistry,
  treeId: string,
  data: LoadedTreeData,
  expandedNodeIds: string[],
  ctx: TreeContext = {},
) => {
  const expanded = new Set(expandedNodeIds);
  const visited = new Set<string>();
  const childrenByNodeId: Record<string, TreeNode[]> = {};

  const loadNodes = async (nodes: TreeNode[]) => {
    await Promise.all(
      nodes.map(async (node) => {
        if (!expanded.has(node.id) || visited.has(node.id)) return;
        visited.add(node.id);
        const children = node.children ?? (await trees.getChildren(treeId, node, ctx));
        if (!node.children) childrenByNodeId[node.id] = children;
        await loadNodes(children);
      }),
    );
  };

  await loadNodes(listTreeNodes(data));
  return childrenByNodeId;
};

// A tree reloads whenever the open resource changes (e.g. selecting a different
// sidenav item) or a refresh fires. Only show the loading state before a tree has
// produced any content; reloads keep the current content so the sidenav never
// blanks between selections.
export const shouldShowTreeLoading = (loadedTreeId: string | null, treeViewId: string) => loadedTreeId !== treeViewId;

export const expandDefaultTreeSections = (trees: TreeRendererRegistry, treeId: string) => {
  const tree = trees.getTreeRenderer(treeId);
  if (!tree) return;
  for (const sectionId of tree.defaultExpandedSectionIds ?? []) {
    trees.setSectionExpanded(treeId, sectionId, true);
  }
};

export const loadTreeData = async (
  trees: TreeRendererRegistry,
  treeId: string,
  ctx: TreeContext = {},
): Promise<LoadedTreeData | null> => {
  if (!trees.getTreeRenderer(treeId)) return null;

  try {
    const [header, body, footer] = await Promise.all([
      trees.getHeader(treeId, ctx),
      trees.getBody(treeId, ctx),
      trees.getFooter(treeId, ctx),
    ]);
    return { header, body, footer };
  } catch (error) {
    if (isUnregisteredTreeError(trees, treeId, error)) return null;
    throw error;
  }
};
