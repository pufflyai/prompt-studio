import type { TreeNode, TreeViewSection } from "../../../core";
import {
  type ResourcePreviewChanges,
  resolveResourcePreview,
} from "../../../core/registries/resources/resource-preview";

export const previewTreeResources = (
  sections: TreeViewSection[],
  childrenByNodeId: Record<string, TreeNode[]>,
  changes: ResourcePreviewChanges,
) => {
  // Selection changes do not change tree data. Keep the snapshot so the renderer
  // can reuse its adapted rows instead of rebuilding every saved session.
  if (changes.size === 0 && Object.keys(childrenByNodeId).length === 0) return sections;
  const previewNodes = (nodes: TreeNode[]): TreeNode[] =>
    nodes.flatMap((node) => {
      const resource = node.resource ? resolveResourcePreview(node.resource, changes) : undefined;
      if (node.resource && !resource) return [];
      const children = childrenByNodeId[node.id] ?? node.children;
      return [
        {
          ...node,
          label: resource && resource !== node.resource ? (resource.label ?? node.label) : node.label,
          ...(resource ? { resource } : {}),
          ...(children ? { children: previewNodes(children) } : {}),
        },
      ];
    });
  return sections.map((section) => ({ ...section, nodes: previewNodes(section.nodes) }));
};
