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
    if (filteredNodes.length === 0 && !section.emptyState && !section.actions?.length && !section.pagination) {
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

export interface TreeVisibilityMenuItems {
  headerSections?: TreeListSection[];
  sections: TreeListSection[];
  footerSections?: TreeListSection[];
}

export interface TreeVisibilityItem {
  key: string;
  label: string;
  section?: string;
  icon?: ReactNode;
  visible: boolean;
  toggle(): void;
}

export const listTreeVisibilityItems = (
  items: TreeVisibilityMenuItems,
  sectionOverrides: Record<string, VisibilityOverride>,
  nodeOverrides: Record<string, VisibilityOverride>,
  actions: Pick<TreeVisibilityMenuActions, "onToggleSection" | "onToggleNode">,
) => {
  const inventory = (sections: TreeListSection[]) =>
    sections.flatMap((section) => {
      const label = section.label ?? section.menuLabel;
      const entries: TreeVisibilityItem[] = [];
      if (label && isCustomizable(section)) {
        entries.push({
          key: `section:${section.id}`,
          label,
          section: label,
          visible: resolveVisibility(sectionOverrides[section.id], section.hiddenByDefault) === "shown",
          toggle: () => actions.onToggleSection(section.id, section.hiddenByDefault === true),
        });
      }
      // Hideability is explicit. The children of top-level rows do not participate.
      for (const node of section.nodes.filter(isCustomizable)) {
        entries.push({
          key: `node:${node.id}`,
          label: toStringLabel(node.label, node.id),
          section: label,
          icon: node.icon,
          visible: isNodeVisible(node, nodeOverrides),
          toggle: () => actions.onToggleNode(node.id, node.hiddenByDefault === true),
        });
      }
      return entries;
    });
  return [inventory(items.headerSections ?? []), inventory(items.sections), inventory(items.footerSections ?? [])];
};

export const buildTreeVisibilityMenuActions = (
  items: TreeVisibilityMenuItems,
  sectionOverrides: Record<string, VisibilityOverride>,
  nodeOverrides: Record<string, VisibilityOverride>,
  actions: TreeVisibilityMenuActions,
  options: BuildMenuOptions,
): ResourceContextAction[] => {
  const result: ResourceContextAction[] = [];
  for (const group of listTreeVisibilityItems(items, sectionOverrides, nodeOverrides, actions)) {
    result.push(
      ...group.map(({ key, label, icon, visible, toggle }, index) => ({
        key,
        label,
        ...(icon ? { icon } : {}),
        onClick: toggle,
        ...(index === 0 && result.length > 0 ? { separatorBefore: true } : {}),
        endContent: visible ? options.visibleIcon : options.hiddenIcon,
      })),
    );
  }
  if (result.length > 0) {
    result.push({
      key: "__reset-visibility",
      label: "Reset to default",
      icon: options.resetIcon,
      separatorBefore: true,
      onClick: actions.onResetAll,
    });
  }
  return result;
};
