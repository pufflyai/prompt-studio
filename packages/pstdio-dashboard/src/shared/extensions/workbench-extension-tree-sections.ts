import type { TreeNode, TreeViewSection } from "@pstdio/workbench";
import {
  dashboardResourceFromExtensionReference,
  normalizeExtensionResourceReference,
} from "@/shared/workbench/resource-hierarchy";
import { resolveLocalizableString } from "./extension-localization";
import { createDashboardExtensionPanelResource } from "./extension-panel-resource";
import {
  createDashboardExtensionRouteResource,
  type DashboardExtensionMetadata,
} from "./workbench-extension-contributions";

type ExtensionTreeItemContribution = NonNullable<DashboardExtensionMetadata["treeItems"]>[number];

const matchesMode = (when: ExtensionTreeItemContribution["when"], modeId: string) => {
  const mode = when?.mode;
  if (!mode) return true;
  return Array.isArray(mode) ? mode.includes(modeId) : mode === modeId;
};

const treeItemOrder = (item: ExtensionTreeItemContribution, index: number) => {
  const placementOrder = { first: 0, default: 1, last: 2 } as const;
  return placementOrder[item.placement ?? "default"] * 1000 + index;
};

const createTreeNode = (input: {
  item: ExtensionTreeItemContribution;
  metadata: DashboardExtensionMetadata;
  projectId: string;
}): TreeNode | null => {
  const { item, metadata, projectId } = input;
  const { action } = item;

  if (action.kind === "command") {
    return {
      id: item.id,
      label: resolveLocalizableString(item.label, item.extensionId),
      icon: item.icon,
      // Extension nav entries are top-level rows — let them opt into the sidenav hide/show menu.
      canHide: true,
      target: { kind: "command", commandId: action.commandId, args: action.args },
    };
  }

  if (action.kind === "href") return null;

  if (action.kind === "panel") {
    const panel = metadata.panels.find((candidate) => candidate.id === action.panelId);
    if (!panel) return null;
    const label = resolveLocalizableString(item.label, item.extensionId);
    const resource = createDashboardExtensionPanelResource({
      extensionId: panel.extensionId,
      icon: item.icon ?? panel.icon,
      label,
      panelId: panel.id,
      projectId,
    });
    return {
      id: resource.uri,
      label,
      icon: item.icon,
      canHide: true,
      resource,
    };
  }

  if (action.kind === "resource") {
    const reference = normalizeExtensionResourceReference(action.resource);
    if (!reference) return null;
    const label = resolveLocalizableString(item.label, item.extensionId);
    // Extension-view references resolve through the canonical panel resource,
    // which needs the owning extension id; other kinds keep their metadata as is.
    const referenceMetadata =
      reference.type === "extension-view" ? { extensionId: item.extensionId, ...reference.metadata } : undefined;
    const resource = dashboardResourceFromExtensionReference(
      { ...reference, label: reference.label ?? label, ...(referenceMetadata ? { metadata: referenceMetadata } : {}) },
      { projectId, fallbackIcon: item.icon },
    );
    return {
      id: resource.uri,
      label,
      icon: item.icon,
      canHide: true,
      resource,
    };
  }

  if (action.kind !== "route") return null;

  const route = metadata.routes.find((candidate) => candidate.path === action.route);
  if (!route) return null;

  const resource = createDashboardExtensionRouteResource({ projectId, route, icon: item.icon });
  return {
    id: resource.uri,
    label: resolveLocalizableString(item.label, item.extensionId),
    icon: item.icon,
    canHide: true,
    resource,
  };
};

export const buildDashboardExtensionTreeSections = (input: {
  metadata: DashboardExtensionMetadata;
  modeId: string;
  projectId: string;
  target: NonNullable<ExtensionTreeItemContribution["target"]>;
  placement?: "first" | "default";
}) => {
  const { metadata, modeId, placement = "default", projectId, target } = input;
  const sectionsByGroup = new Map<string, TreeViewSection>();

  (metadata.treeItems ?? [])
    .filter((item) => item.target === target)
    .filter((item) => matchesMode(item.when, modeId))
    .filter((item) => (placement === "first" ? item.placement === "first" : item.placement !== "first"))
    .map((item, index) => ({ item, order: treeItemOrder(item, index) }))
    .sort((left, right) => left.order - right.order || left.item.id.localeCompare(right.item.id))
    .forEach(({ item }) => {
      const node = createTreeNode({ item, metadata, projectId });
      if (!node) return;

      // `group: null` places the item at the root without a heading;
      // an undefined group keeps the default "Extensions" section.
      const group = item.group === null ? null : (item.group ?? "Extensions");
      const sectionKey = group ?? "__root__";
      const section = sectionsByGroup.get(sectionKey) ?? {
        id: `extension-tree-group:${target}:${placement}:${sectionKey}`,
        ...(group === null ? {} : { label: group }),
        collapsible: false,
        nodes: [],
      };
      section.nodes.push(node);
      sectionsByGroup.set(sectionKey, section);
    });

  return [...sectionsByGroup.values()];
};
