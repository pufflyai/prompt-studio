import {
  buildTreeVisibilityMenuActions,
  filterVisibleNodes,
  filterVisibleSections,
  type ResourceContextAction,
  resolveVisibility,
  type TreeListActionMenuItem,
  type TreeListNode,
  type TreeListSection,
  useTreeListVisibilityStore,
  type VisibilityOverride,
} from "@pstdio/ui";
import type { ReactNode } from "react";

interface TreeViewRegions {
  headerNodes: TreeListNode[];
  sections: TreeListSection[];
  footerNodes: TreeListNode[];
}

interface TreeViewCustomization {
  // Header rows with hidden entries removed — what the header region renders.
  visibleHeaderNodes: TreeListNode[];
  // Sections with hidden categories removed — what the tree body renders.
  visibleSections: TreeListSection[];
  // Footer rows with hidden entries removed — what the footer region renders.
  visibleFooterNodes: TreeListNode[];
  // Back-of-tree right-click menu: header rows, body categories, and footer rows that opt in.
  backgroundContextActions: ResourceContextAction[];
}

interface VisibilityToggleIcons {
  visibleIcon: ReactNode;
  hiddenIcon: ReactNode;
  resetIcon?: ReactNode;
}

interface NodeVisibilityActions {
  onToggleNode: (id: string, hiddenByDefault: boolean) => void;
}

const toStringLabel = (label: ReactNode, fallback: string) => (typeof label === "string" ? label : fallback);

const isCustomizableNode = (node: TreeListNode) => node.canHide === true || node.hiddenByDefault === true;

const visibilityContextIcon = (effective: VisibilityOverride, icons: VisibilityToggleIcons) =>
  effective === "shown" ? icons.hiddenIcon : icons.visibleIcon;

const buildNodeVisibilityContextMenuItem = (
  node: TreeListNode,
  nodeOverrides: Record<string, VisibilityOverride>,
  actions: NodeVisibilityActions,
  icons: VisibilityToggleIcons,
): TreeListActionMenuItem | undefined => {
  if (!isCustomizableNode(node)) return undefined;

  const hiddenByDefault = node.hiddenByDefault === true;
  const effective = resolveVisibility(nodeOverrides[node.id], hiddenByDefault);
  const label = toStringLabel(node.label, node.id);
  const existingItems = node.contextMenuItems ?? [];

  return {
    id: `tree-visibility:${node.id}`,
    label: effective === "shown" ? `Hide ${label}` : `Show ${label}`,
    icon: visibilityContextIcon(effective, icons),
    ...(existingItems.length > 0 ? { separatorBefore: true } : {}),
    onAction: () => actions.onToggleNode(node.id, hiddenByDefault),
  };
};

export const addRegionNodeVisibilityContextMenuItems = (
  nodes: TreeListNode[],
  nodeOverrides: Record<string, VisibilityOverride>,
  actions: NodeVisibilityActions,
  icons: VisibilityToggleIcons,
) => {
  let changed = false;
  const next = nodes.map((node) => {
    const item = buildNodeVisibilityContextMenuItem(node, nodeOverrides, actions, icons);
    if (!item) return node;

    changed = true;
    return { ...node, contextMenuItems: [...(node.contextMenuItems ?? []), item] };
  });

  return changed ? next : nodes;
};

// Wires the generic @pstdio/ui visibility primitives onto a single tree host. Visibility is
// persisted per `storageKey`, so each tree view customizes independently. The menu is built from
// the unfiltered regions so hidden entries stay listed (eye-off) and can be brought back —
// covering header rows, body categories, and footer rows (never individual body items).
export const useTreeViewCustomization = (
  storageKey: string,
  regions: TreeViewRegions,
  icons: VisibilityToggleIcons,
): TreeViewCustomization => {
  const sectionOverrides = useTreeListVisibilityStore(storageKey, (state) => state.sectionOverrides);
  const nodeOverrides = useTreeListVisibilityStore(storageKey, (state) => state.nodeOverrides);
  const toggleSection = useTreeListVisibilityStore(storageKey, (state) => state.toggleSection);
  const toggleNode = useTreeListVisibilityStore(storageKey, (state) => state.toggleNode);
  const reset = useTreeListVisibilityStore(storageKey, (state) => state.reset);
  const visibilityActions = { onToggleSection: toggleSection, onToggleNode: toggleNode, onResetAll: reset };

  const headerNodes = addRegionNodeVisibilityContextMenuItems(
    regions.headerNodes,
    nodeOverrides,
    visibilityActions,
    icons,
  );
  const footerNodes = addRegionNodeVisibilityContextMenuItems(
    regions.footerNodes,
    nodeOverrides,
    visibilityActions,
    icons,
  );
  const visibleHeaderNodes = filterVisibleNodes(headerNodes, nodeOverrides);
  const visibleSections = filterVisibleSections(regions.sections, sectionOverrides, nodeOverrides);
  const visibleFooterNodes = filterVisibleNodes(footerNodes, nodeOverrides);
  const backgroundContextActions = buildTreeVisibilityMenuActions(
    { headerNodes: regions.headerNodes, sections: regions.sections, footerNodes: regions.footerNodes },
    sectionOverrides,
    nodeOverrides,
    visibilityActions,
    icons,
  );

  return { visibleHeaderNodes, visibleSections, visibleFooterNodes, backgroundContextActions };
};
