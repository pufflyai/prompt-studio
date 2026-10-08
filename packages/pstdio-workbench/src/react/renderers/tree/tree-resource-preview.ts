import type { ResourceRegistry, TreeNode, TreeViewSection } from "../../../core";

export const previewTreeResources = (
  sections: TreeViewSection[],
  childrenByNodeId: Record<string, TreeNode[]>,
  resources: ResourceRegistry,
) => {
  const previewNodes = (nodes: TreeNode[]): TreeNode[] =>
    nodes.flatMap((node) => {
      const resource = node.resource ? resources.preview.resolve(node.resource) : undefined;
      if (node.resource && !resource) return [];
      const children = childrenByNodeId[node.id] ?? node.children;
      return [
        {
          ...node,
          label: resource?.label ?? node.label,
          ...(resource ? { resource } : {}),
          ...(children ? { children: previewNodes(children) } : {}),
        },
      ];
    });
  return sections.map((section) => ({ ...section, nodes: previewNodes(section.nodes) }));
};
