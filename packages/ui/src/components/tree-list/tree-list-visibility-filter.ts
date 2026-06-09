import type { ReactNode } from "react";
import type { ResourceContextAction } from "../resource-context-menu";
import type { TreeListNode, TreeListSection } from "./tree-list.types";
import type { VisibilityOverride } from "./tree-list-visibility.store";

const toStringLabel = (label: ReactNode, fallback: string) => (typeof label === "string" ? label : fallback);

export const resolveVisibility = (
  override: VisibilityOverride | undefined,
  hiddenByDefault: boolean | undefined,
): VisibilityOverride => override ?? (hiddenByDefault ? "hidden" : "shown");

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
  onResetOrder?: () => void;
}

interface BuildMenuOptions {
  checkmark: ReactNode;
}

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
    endContent: effective === "shown" ? options.checkmark : null,
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
  // Locked nodes stay visible and are surfaced as a disabled, checked row.
  const locked = node.canHide === false;
  return {
    key: `node:${node.id}`,
    label: toStringLabel(node.label, node.id),
    isDisabled: locked,
    onClick: locked ? () => {} : () => actions.onToggleNode(node.id, hiddenByDefault),
    endContent: locked || effective === "shown" ? options.checkmark : null,
  };
};

export const buildTreeVisibilityMenuActions = (
  sections: TreeListSection[],
  sectionOverrides: Record<string, VisibilityOverride>,
  nodeOverrides: Record<string, VisibilityOverride>,
  actions: TreeVisibilityMenuActions,
  options: BuildMenuOptions,
): ResourceContextAction[] => {
  const result: ResourceContextAction[] = [];

  for (const section of sections) {
    // Unlabeled sections are structural groupings, not user-facing toggle targets.
    if (section.label) result.push(buildSectionAction(section, sectionOverrides, actions, options));
    const sectionEffective = resolveVisibility(sectionOverrides[section.id], section.hiddenByDefault);
    if (sectionEffective === "hidden") continue;
    for (const node of section.nodes) {
      result.push(buildNodeAction(node, nodeOverrides, actions, options));
    }
  }

  result.push({ key: "__reset-visibility", label: "Reset to default", onClick: actions.onResetAll });
  if (actions.onResetOrder) {
    result.push({ key: "__reset-order", label: "Reset order", onClick: actions.onResetOrder });
  }

  return result;
};
