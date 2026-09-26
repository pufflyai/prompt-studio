import type { TreeNode, TreeQueryContext, TreeRendererRegistry, TreeViewSection } from "../../../core";
import { settleReadBatch } from "../../../core/registries/views/settle-read-batch";

const isUnregisteredTreeError = (trees: TreeRendererRegistry, treeId: string, error: unknown) =>
  error instanceof Error &&
  error.message === `Tree renderer not registered: ${treeId}` &&
  !trees.getTreeRenderer(treeId);

export interface LoadedTreeData {
  header: TreeViewSection[];
  body: TreeViewSection[];
  footer: TreeViewSection[];
}

const listTreeNodes = (data: LoadedTreeData) => [
  ...data.header.flatMap((section) => section.nodes),
  ...data.body.flatMap((section) => section.nodes),
  ...data.footer.flatMap((section) => section.nodes),
];

export const loadExpandedTreeChildren = async (
  trees: TreeRendererRegistry,
  treeId: string,
  data: LoadedTreeData,
  expandedNodeIds: string[],
  ctx: TreeQueryContext = {},
) => {
  const expanded = new Set(expandedNodeIds);
  const visited = new Set<string>();
  const childrenByNodeId: Record<string, TreeNode[]> = {};

  const queue = listTreeNodes(data);
  while (queue.length) {
    ctx.signal?.throwIfAborted();
    const batch: TreeNode[] = [];
    while (queue.length && batch.length < 4) {
      const node = queue.shift()!;
      if (!expanded.has(node.id) || visited.has(node.id)) continue;
      visited.add(node.id);
      batch.push(node);
    }
    const children = await settleReadBatch(
      batch.map((node) => async (signal: AbortSignal) => {
        const children = node.children ?? (await trees.getChildren(treeId, node, { ...ctx, signal }));
        if (!node.children) childrenByNodeId[node.id] = children;
        return children;
      }),
      ctx.signal,
    );
    queue.push(...children.flat());
  }
  return childrenByNodeId;
};

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
  ctx: TreeQueryContext = {},
): Promise<LoadedTreeData | null> => {
  if (!trees.getTreeRenderer(treeId)) return null;

  try {
    const [header, body, footer] = await settleReadBatch(
      [
        (signal) => trees.getHeader(treeId, { ...ctx, signal }),
        (signal) => trees.getBody(treeId, { ...ctx, signal }),
        (signal) => trees.getFooter(treeId, { ...ctx, signal }),
      ],
      ctx.signal,
    );
    return { header, body, footer };
  } catch (error) {
    if (isUnregisteredTreeError(trees, treeId, error)) return null;
    throw error;
  }
};
