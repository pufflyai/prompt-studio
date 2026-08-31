import {
  applyTreeListOrder,
  buildTreeVisibilityMenuActions,
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
  headerSections: TreeListSection[];
  sections: TreeListSection[];
  footerSections: TreeListSection[];
}

export type TreeViewSlot = "header" | "content" | "footer";

interface TreeViewCustomization {
  // Header sections with hidden entries removed — what the pinned header renders.
  visibleHeaderSections: TreeListSection[];
  // Sections with hidden categories removed — what the tree body renders.
  visibleSections: TreeListSection[];
  // Footer sections with hidden entries removed — what the pinned footer renders.
  visibleFooterSections: TreeListSection[];
  // Back-of-tree right-click menu: header rows, body categories, and footer rows that opt in.
  backgroundContextActions: ResourceContextAction[];
  customizationRevision: string;
  onReorderSections: (slot: TreeViewSlot, nextSectionIds: string[]) => void;
  onMoveSection: (nextSectionIds: string[], sourceSectionId: string, destinationSectionId: string) => void;
  onReorderNodes: (sectionId: string, nextNodeIds: string[]) => void;
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

const addSectionNodeVisibilityContextMenuItems = (
  sections: TreeListSection[],
  nodeOverrides: Record<string, VisibilityOverride>,
  actions: NodeVisibilityActions,
  icons: VisibilityToggleIcons,
  enabled: boolean,
) => {
  let changed = false;
  const next = sections.map((section) => {
    const nodes = addRegionNodeVisibilityContextMenuItems(section.nodes, nodeOverrides, actions, icons, enabled);
    if (nodes === section.nodes) return section;
    changed = true;
    return { ...section, nodes };
  });
  return changed ? next : sections;
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
  const sectionSlotById = useTreeListOrderStore(storageKey, (state) => state.sectionSlotById);
  const setSectionOrder = useTreeListOrderStore(storageKey, (state) => state.setSectionOrder);
  const setNodeOrder = useTreeListOrderStore(storageKey, (state) => state.setNodeOrder);
  const setSectionSlot = useTreeListOrderStore(storageKey, (state) => state.setSectionSlot);
  const resetOrder = useTreeListOrderStore(storageKey, (state) => state.reset);
  const visibilityActions = {
    onToggleSection: toggleSection,
    onToggleNode: toggleNode,
    onResetAll: () => {
      resetVisibility();
      resetOrder();
    },
  };

  const defaultSlotBySectionId = new Map([
    ...regions.headerSections.map((section) => [section.id, "header" as const] as const),
    ...regions.sections.map((section) => [section.id, "content" as const] as const),
    ...regions.footerSections.map((section) => [section.id, "footer" as const] as const),
  ]);
  const orderedSectionsBySlot: Record<TreeViewSlot, TreeListSection[]> = { header: [], content: [], footer: [] };
  const orderedAllSections = applyTreeListOrder(
    [...regions.headerSections, ...regions.sections, ...regions.footerSections],
    sectionOrder,
    nodeOrderBySection,
  );
  for (const section of orderedAllSections) {
    const slot = sectionSlotById[section.id] ?? defaultSlotBySectionId.get(section.id) ?? "content";
    orderedSectionsBySlot[slot].push(section);
  }
  const orderedHeaderSections = orderedSectionsBySlot.header;
  const orderedSections = orderedSectionsBySlot.content;
  const orderedFooterSections = orderedSectionsBySlot.footer;
  const includeNodeContextMenus = options.suppressNodeContextMenus !== true;

  const headerSections = addSectionNodeVisibilityContextMenuItems(
    orderedHeaderSections,
    nodeOverrides,
    visibilityActions,
    icons,
    includeNodeContextMenus,
  );
  const contentSections = addSectionNodeVisibilityContextMenuItems(
    orderedSections,
    nodeOverrides,
    visibilityActions,
    icons,
    includeNodeContextMenus,
  );
  const footerSections = addSectionNodeVisibilityContextMenuItems(
    orderedFooterSections,
    nodeOverrides,
    visibilityActions,
    icons,
    includeNodeContextMenus,
  );
  const visibleHeaderSections = filterVisibleSections(headerSections, sectionOverrides, nodeOverrides);
  const visibleSections = filterVisibleSections(contentSections, sectionOverrides, nodeOverrides);
  const visibleFooterSections = filterVisibleSections(footerSections, sectionOverrides, nodeOverrides);
  const backgroundContextActions = buildTreeVisibilityMenuActions(
    { headerSections: orderedHeaderSections, sections: orderedSections, footerSections: orderedFooterSections },
    sectionOverrides,
    nodeOverrides,
    visibilityActions,
    icons,
  );

  const customizationRevision = JSON.stringify({
    header: orderedHeaderSections.map((section) => [
      section.id,
      toStringLabel(section.label, section.id),
      section.nodes.map((node) => [node.id, toStringLabel(node.label, node.id)]),
    ]),
    main: orderedSections.map((section) => [
      section.id,
      toStringLabel(section.label, section.id),
      section.nodes.map((node) => [node.id, toStringLabel(node.label, node.id)]),
    ]),
    footer: orderedFooterSections.map((section) => [
      section.id,
      toStringLabel(section.label, section.id),
      section.nodes.map((node) => [node.id, toStringLabel(node.label, node.id)]),
    ]),
    sectionOverrides,
    nodeOverrides,
    sectionOrder,
    nodeOrderBySection,
    sectionSlotById,
  });

  return {
    visibleHeaderSections,
    visibleSections,
    visibleFooterSections,
    backgroundContextActions,
    customizationRevision,
    onReorderSections: (slot, nextSectionIds) => {
      const idsBySlot: Record<TreeViewSlot, string[]> = {
        header: orderedHeaderSections.map((section) => section.id),
        content: orderedSections.map((section) => section.id),
        footer: orderedFooterSections.map((section) => section.id),
      };
      idsBySlot[slot] = nextSectionIds;
      setSectionOrder([...idsBySlot.header, ...idsBySlot.content, ...idsBySlot.footer]);
    },
    onMoveSection: (nextSectionIds, sourceSectionId, destinationSectionId) => {
      const destinationSlot =
        sectionSlotById[destinationSectionId] ?? defaultSlotBySectionId.get(destinationSectionId) ?? "content";
      setSectionSlot(sourceSectionId, destinationSlot);
      setSectionOrder(nextSectionIds);
    },
    onReorderNodes: setNodeOrder,
  };
};
