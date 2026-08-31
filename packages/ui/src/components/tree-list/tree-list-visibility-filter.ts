import type { ReactNode } from "react";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import type { TreeListNode, TreeListSection } from "./tree-list.types";
import type { VisibilityOverride } from "./tree-list-visibility.store";

const toStringLabel = (label: ReactNode, fallback: string) => (typeof label === "string" ? label : fallback);

export const resolveVisibility = (
  override: VisibilityOverride | undefined,
  hiddenByDefault: boolean | undefined,
): VisibilityOverride => override ?? (hiddenByDefault ? "hidden" : "shown");

// A section or node is "customizable": it opts in to the hide/show menu and may be toggled.
// Hideability is explicit — items are non-hideable unless they set canHide (or start hidden by
// default, which would otherwise be unrecoverable). Body sub-items never opt in, so only
// categories (sections) and header/footer rows ever appear in the customize menu.
const isCustomizable = (item: { canHide?: boolean; hiddenByDefault?: boolean }) =>
  item.canHide === true || item.hiddenByDefault === true;

const isNodeVisible = (node: TreeListNode, nodeOverrides: Record<string, VisibilityOverride>) =>
  resolveVisibility(nodeOverrides[node.id], node.hiddenByDefault) === "shown";

const filterNodes = (nodes: TreeListNode[], nodeOverrides: Record<string, VisibilityOverride>): TreeListNode[] => {
  let changed = false;
  const next: TreeListNode[] = [];
  for (const node of nodes) {
    if (!isNodeVisible(node, nodeOverrides)) {
      changed = true;
      continue;
    }
    if (node.children && node.children.length > 0) {
      const filteredChildren = filterNodes(node.children, nodeOverrides);
      if (filteredChildren !== node.children) {
        changed = true;
        next.push({ ...node, children: filteredChildren });
        continue;
      }
    }
    next.push(node);
  }
  return changed ? next : nodes;
};

// Header/footer rows are flat lists, filtered by their own node overrides (mirrors the body's
// per-node filtering, minus section nesting).
export const filterVisibleNodes = (
  nodes: TreeListNode[],
  nodeOverrides: Record<string, VisibilityOverride>,
): TreeListNode[] => filterNodes(nodes, nodeOverrides);

export const filterVisibleSections = (
  sections: TreeListSection[],
  sectionOverrides: Record<string, VisibilityOverride>,
  nodeOverrides: Record<string, VisibilityOverride>,
): TreeListSection[] => {
  let changed = false;
  const next: TreeListSection[] = [];
  for (const section of sections) {
    if (resolveVisibility(sectionOverrides[section.id], section.hiddenByDefault) === "hidden") {
      changed = true;
      continue;
    }
    const filteredNodes = filterNodes(section.nodes, nodeOverrides);
    if (filteredNodes.length === 0 && !section.emptyState) {
      changed = true;
      continue;
    }
    if (filteredNodes !== section.nodes) {
      changed = true;
      next.push({ ...section, nodes: filteredNodes });
      continue;
    }
    next.push(section);
  }
  return changed ? next : sections;
};

export interface TreeVisibilityMenuActions {
  onToggleSection: (id: string, hiddenByDefault: boolean) => void;
  onToggleNode: (id: string, hiddenByDefault: boolean) => void;
  onResetAll: () => void;
}

interface BuildMenuOptions {
  // Trailing toggle indicator: an eye when the entry is shown, eye-off when hidden.
  visibleIcon: ReactNode;
  hiddenIcon: ReactNode;
  // Leading icon for the reset rows, kept separate from the toggle list above.
  resetIcon?: ReactNode;
}

const visibilityEndContent = (effective: VisibilityOverride, options: BuildMenuOptions) =>
  effective === "shown" ? options.visibleIcon : options.hiddenIcon;

const buildSectionAction = (
  section: TreeListSection,
  sectionOverrides: Record<string, VisibilityOverride>,
  actions: TreeVisibilityMenuActions,
  options: BuildMenuOptions,
): ResourceContextAction => {
  const hiddenByDefault = section.hiddenByDefault === true;
  const effective = resolveVisibility(sectionOverrides[section.id], hiddenByDefault);
  return {
    key: `section:${section.id}`,
    label: section.label ?? section.id,
    onClick: () => actions.onToggleSection(section.id, hiddenByDefault),
    endContent: visibilityEndContent(effective, options),
  };
};

const buildNodeAction = (
  node: TreeListNode,
  nodeOverrides: Record<string, VisibilityOverride>,
  actions: TreeVisibilityMenuActions,
  options: BuildMenuOptions,
): ResourceContextAction => {
  const hiddenByDefault = node.hiddenByDefault === true;
  const effective = resolveVisibility(nodeOverrides[node.id], hiddenByDefault);
  return {
    key: `node:${node.id}`,
    label: toStringLabel(node.label, node.id),
    icon: node.icon,
    onClick: () => actions.onToggleNode(node.id, hiddenByDefault),
    endContent: visibilityEndContent(effective, options),
  };
};

export interface TreeVisibilityMenuItems {
  headerSections?: TreeListSection[];
  sections: TreeListSection[];
  footerSections?: TreeListSection[];
}

// Builds the back-of-tree hide/show menu. Every slot uses sections, so the same rules apply to
// pinned and scrolling content. Hideability is explicit per item.
export const buildTreeVisibilityMenuActions = (
  items: TreeVisibilityMenuItems,
  sectionOverrides: Record<string, VisibilityOverride>,
  nodeOverrides: Record<string, VisibilityOverride>,
  actions: TreeVisibilityMenuActions,
  options: BuildMenuOptions,
): ResourceContextAction[] => {
  const result: ResourceContextAction[] = [];
  const appendGroup = (group: ResourceContextAction[]) => {
    if (group.length === 0) return;
    if (result.length > 0) group[0] = { ...group[0], separatorBefore: true };
    result.push(...group);
  };

  const actionsForSections = (sections: TreeListSection[]) => {
    const sectionActions: ResourceContextAction[] = [];
    for (const section of sections) {
      if (isCustomizable(section)) {
        sectionActions.push(buildSectionAction(section, sectionOverrides, actions, options));
      }
      // Top-level rows that opt in (e.g. a "Tickets" nav entry) are hideable too; their leaf
      // children are not visited, so files/sessions inside a category stay non-hideable.
      for (const node of section.nodes) {
        if (isCustomizable(node)) sectionActions.push(buildNodeAction(node, nodeOverrides, actions, options));
      }
    }
    return sectionActions;
  };

  appendGroup(actionsForSections(items.headerSections ?? []));
  appendGroup(actionsForSections(items.sections));
  appendGroup(actionsForSections(items.footerSections ?? []));

  if (result.length === 0) return result;

  // A separator splits the visibility toggles above from the reset actions below.
  result.push({
    key: "__reset-visibility",
    label: "Reset to default",
    icon: options.resetIcon,
    separatorBefore: true,
    onClick: actions.onResetAll,
  });

  return result;
};
