import {
  applyTreeListOrder,
  buildTreeVisibilityMenuActions,
  filterVisibleNodes,
  filterVisibleSections,
  type ResourceContextAction,
  resolveVisibility,
  type TreeListActionMenuItem,
  type TreeListNode,
  type TreeListSection,
  useTreeListOrderStore,
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
  customizationRevision: string;
  onReorderHeaderNodes: (nextNodeIds: string[]) => void;
  onReorderSections: (nextSectionIds: string[]) => void;
  onReorderNodes: (sectionId: string, nextNodeIds: string[]) => void;
  onReorderFooterNodes: (nextNodeIds: string[]) => void;
}

interface VisibilityToggleIcons {
  visibleIcon: ReactNode;
  hiddenIcon: ReactNode;
  resetIcon?: ReactNode;
}

interface NodeVisibilityActions {
  onToggleNode: (id: string, hiddenByDefault: boolean) => void;
}

interface TreeViewCustomizationOptions {
  suppressNodeContextMenus?: boolean;
}

const HEADER_SECTION_ID = "__header__";
const FOOTER_SECTION_ID = "__footer__";

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
  enabled = true,
) => {
  if (!enabled) return nodes;
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
  options: TreeViewCustomizationOptions = {},
): TreeViewCustomization => {
  const sectionOverrides = useTreeListVisibilityStore(storageKey, (state) => state.sectionOverrides);
  const nodeOverrides = useTreeListVisibilityStore(storageKey, (state) => state.nodeOverrides);
  const toggleSection = useTreeListVisibilityStore(storageKey, (state) => state.toggleSection);
  const toggleNode = useTreeListVisibilityStore(storageKey, (state) => state.toggleNode);
  const resetVisibility = useTreeListVisibilityStore(storageKey, (state) => state.reset);
  const sectionOrder = useTreeListOrderStore(storageKey, (state) => state.sectionOrder);
  const nodeOrderBySection = useTreeListOrderStore(storageKey, (state) => state.nodeOrderBySection);
  const setSectionOrder = useTreeListOrderStore(storageKey, (state) => state.setSectionOrder);
  const setNodeOrder = useTreeListOrderStore(storageKey, (state) => state.setNodeOrder);
  const resetOrder = useTreeListOrderStore(storageKey, (state) => state.reset);
  const visibilityActions = {
    onToggleSection: toggleSection,
    onToggleNode: toggleNode,
    onResetAll: () => {
      resetVisibility();
      resetOrder();
    },
  };

  const orderedSections = applyTreeListOrder(regions.sections, sectionOrder, nodeOrderBySection);
  const orderedHeaderNodes =
    applyTreeListOrder(
      [{ id: HEADER_SECTION_ID, canReorder: false, nodes: regions.headerNodes }],
      [],
      nodeOrderBySection,
    )[0]?.nodes ?? [];
  const orderedFooterNodes =
    applyTreeListOrder(
      [{ id: FOOTER_SECTION_ID, canReorder: false, nodes: regions.footerNodes }],
      [],
      nodeOrderBySection,
    )[0]?.nodes ?? [];
  const includeNodeContextMenus = options.suppressNodeContextMenus !== true;

  const headerNodes = addRegionNodeVisibilityContextMenuItems(
    orderedHeaderNodes,
    nodeOverrides,
    visibilityActions,
    icons,
    includeNodeContextMenus,
  );
  const footerNodes = addRegionNodeVisibilityContextMenuItems(
    orderedFooterNodes,
    nodeOverrides,
    visibilityActions,
    icons,
    includeNodeContextMenus,
  );
  const visibleHeaderNodes = filterVisibleNodes(headerNodes, nodeOverrides);
  const visibleSections = filterVisibleSections(orderedSections, sectionOverrides, nodeOverrides);
  const visibleFooterNodes = filterVisibleNodes(footerNodes, nodeOverrides);
  const backgroundContextActions = buildTreeVisibilityMenuActions(
    { headerNodes: orderedHeaderNodes, sections: orderedSections, footerNodes: orderedFooterNodes },
    sectionOverrides,
    nodeOverrides,
    visibilityActions,
    icons,
  );

  const customizationRevision = JSON.stringify({
    header: orderedHeaderNodes.map((node) => [node.id, toStringLabel(node.label, node.id)]),
    main: orderedSections.map((section) => [
      section.id,
      toStringLabel(section.label, section.id),
      section.nodes.map((node) => [node.id, toStringLabel(node.label, node.id)]),
    ]),
    footer: orderedFooterNodes.map((node) => [node.id, toStringLabel(node.label, node.id)]),
    sectionOverrides,
    nodeOverrides,
    sectionOrder,
    nodeOrderBySection,
  });

  return {
    visibleHeaderNodes,
    visibleSections,
    visibleFooterNodes,
    backgroundContextActions,
    customizationRevision,
    onReorderHeaderNodes: (nextNodeIds) => setNodeOrder(HEADER_SECTION_ID, nextNodeIds),
    onReorderSections: setSectionOrder,
    onReorderNodes: setNodeOrder,
    onReorderFooterNodes: (nextNodeIds) => setNodeOrder(FOOTER_SECTION_ID, nextNodeIds),
  };
};
