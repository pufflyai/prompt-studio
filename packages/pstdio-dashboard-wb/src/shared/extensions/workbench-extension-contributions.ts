import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ExtensionMenuContribution,
  ExtensionTreeItemContribution,
} from "@pstdio/sdk/api";
import {
  buildWorkbenchExtensionMenuRegistrations,
  emptyWorkbenchExtensionMetadata,
  type WorkbenchExtensionMenuSlotConfig,
  type WorkbenchExtensionRoute,
} from "pstdio-extensions/workbench";
import {
  type ResourceRef,
  type TreeNode,
  type TreeViewSection,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-workbench/core";

export const dashboardExtensionRouteKind = "extension-route";
export const projectHeaderPrimarySlotId = "project.headerPrimary";
export const projectHeaderOverflowSlotId = "project.headerOverflow";
export const projectCommandPanelSlotId = "project.commandPanel";
export const workspaceHeaderPrimarySlotId = "workspace.headerPrimary";
export const workspaceHeaderOverflowSlotId = "workspace.headerOverflow";
export const dashboardActiveResourceKindContextKey = "dashboard.activeResource.kind";
export const dashboardActiveResourceIdContextKey = "dashboard.activeResource.id";
export const dashboardActiveResourceMetadataContextKey = (key: string) => `dashboard.activeResource.metadata.${key}`;

export type DashboardExtensionRoute = WorkbenchExtensionRoute;
type ExtensionWhenExpression = NonNullable<ExtensionMenuContribution["when"]>;

export const emptyDashboardExtensionMetadata = emptyWorkbenchExtensionMetadata;

const metadataByProjectId = new Map<string, DashboardExtensionMetadata>();
const metadataListeners = new Set<() => void>();

const notifyMetadataListeners = () => {
  for (const listener of metadataListeners) listener();
};

export const setCachedDashboardExtensionMetadata = (projectId: string, metadata: DashboardExtensionMetadata) => {
  metadataByProjectId.set(projectId, metadata);
  notifyMetadataListeners();
};

export const clearCachedDashboardExtensionMetadata = (projectId: string | undefined) => {
  if (!projectId) return;
  metadataByProjectId.delete(projectId);
  notifyMetadataListeners();
};

export const getCachedDashboardExtensionMetadata = (projectId: string | undefined) =>
  projectId ? metadataByProjectId.get(projectId) : undefined;

export const subscribeDashboardExtensionMetadata = (listener: () => void) => {
  metadataListeners.add(listener);
  return () => {
    metadataListeners.delete(listener);
  };
};

const routeResourceUri = (projectId: string, routePath: string) =>
  `dashboard-workbench://project/${projectId}/extensions/${routePath}`;

export const createDashboardExtensionRouteResource = (input: {
  projectId: string;
  route: DashboardExtensionRoute;
  icon?: string;
}) => {
  const { icon, projectId, route } = input;

  return {
    kind: dashboardExtensionRouteKind,
    uri: routeResourceUri(projectId, route.path),
    id: route.path,
    label: route.label,
    icon: icon ?? "PanelLeft",
    metadata: {
      extensionId: route.extensionId,
      projectId,
      route,
      routePath: route.path,
      favoriteScope: { scope: "project", projectId },
    },
  } satisfies ResourceRef;
};

const menuSlotsById = new Map<string, WorkbenchExtensionMenuSlotConfig>([
  [projectHeaderPrimarySlotId, { menuPath: workbenchTopHeaderTrailingMenuPath, group: "primary" }],
  [
    projectHeaderOverflowSlotId,
    { menuPath: workbenchTopHeaderTrailingMenuPath, group: "overflow", overflowLabel: "Extension actions" },
  ],
  [projectCommandPanelSlotId, { menuPath: workbenchCommandPaletteMenuPath }],
  [workspaceHeaderPrimarySlotId, { menuPath: workbenchTopHeaderTrailingMenuPath, group: "primary" }],
  [
    workspaceHeaderOverflowSlotId,
    { menuPath: workbenchTopHeaderTrailingMenuPath, group: "overflow", overflowLabel: "Workspace actions" },
  ],
]);

const defaultMenuSlotWhenById = new Map<string, string>([
  [workspaceHeaderPrimarySlotId, `${dashboardActiveResourceKindContextKey} == "workspace"`],
  [workspaceHeaderOverflowSlotId, `${dashboardActiveResourceKindContextKey} == "workspace"`],
]);

const menuTargetsById = new Map<string, WorkbenchExtensionMenuSlotConfig>([
  ["workbench.top.actions", { menuPath: workbenchTopHeaderTrailingMenuPath, group: "primary" }],
  [
    "workbench.top.overflow",
    { menuPath: workbenchTopHeaderTrailingMenuPath, group: "overflow", overflowLabel: "Extension actions" },
  ],
  ["workbench.commandPalette", { menuPath: workbenchCommandPaletteMenuPath }],
]);

const createWorkbenchExtensionCommandId = (contribution: ExtensionMenuContribution) =>
  `dashboard.extension.menu.${contribution.id}`;

const isContextPrimitive = (value: unknown) =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const contextValue = (value: string | number | boolean) => JSON.stringify(String(value));

const modeTerms = (mode: ExtensionWhenExpression["mode"] | undefined) => {
  if (!mode) return [] as string[];
  const modes = Array.isArray(mode) ? mode : [mode];
  return modes.map((modeId) => `activeWorkbenchMode == ${contextValue(modeId)}`);
};

const buildDashboardWorkbenchWhenExpression = (when: ExtensionMenuContribution["when"]) => {
  if (!when) return undefined;

  const resourceTypeTerms =
    when.resourceType?.map(
      (resourceType) => `${dashboardActiveResourceKindContextKey} == ${contextValue(resourceType)}`,
    ) ?? [];
  const metadataTerms = Object.entries(when.metadata ?? {})
    .filter((entry): entry is [string, string | number | boolean] => isContextPrimitive(entry[1]))
    .map(([key, value]) => `${dashboardActiveResourceMetadataContextKey(key)} == ${contextValue(value)}`);
  const activeModeTerms = modeTerms(when.mode);

  const modeBranches = activeModeTerms.length > 0 ? activeModeTerms : [undefined];
  const resourceBranches = resourceTypeTerms.length > 0 ? resourceTypeTerms : [undefined];

  return modeBranches
    .flatMap((modeTerm) =>
      resourceBranches.map((resourceTerm) => [modeTerm, resourceTerm, ...metadataTerms].filter(Boolean).join(" && ")),
    )
    .filter(Boolean)
    .join(" || ");
};

export const buildDashboardExtensionMenuRegistrations = (metadata: DashboardExtensionMetadata) =>
  buildWorkbenchExtensionMenuRegistrations({
    metadata,
    menuSlotsById,
    menuTargetsById,
    createCommandId: createWorkbenchExtensionCommandId,
    createWhenExpression: (contribution) => {
      const defaultWhen = contribution.target ? undefined : defaultMenuSlotWhenById.get(contribution.slotId);
      const contributionWhen = buildDashboardWorkbenchWhenExpression(contribution.when);
      return [defaultWhen, contributionWhen].filter(Boolean).join(" && ") || undefined;
    },
  });

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
      label: item.label,
      icon: item.icon,
      target: { kind: "command", commandId: action.commandId, args: action.args },
    };
  }

  if (action.kind === "dataRenderer") return null;

  if (action.kind === "href") return null;

  const route = metadata.routes.find((candidate) => candidate.path === action.route);
  if (!route) return null;

  const resource = createDashboardExtensionRouteResource({ projectId, route, icon: item.icon });
  return {
    id: resource.uri,
    label: item.label,
    icon: item.icon,
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

      const group = item.group ?? "Extensions";
      const section = sectionsByGroup.get(group) ?? {
        id: `extension-tree-group:${target}:${placement}:${group}`,
        label: group,
        collapsible: false,
        nodes: [],
      };
      section.nodes.push(node);
      sectionsByGroup.set(group, section);
    });

  return [...sectionsByGroup.values()];
};

export const buildDashboardExtensionRouteEntries = (input: {
  metadata: DashboardExtensionMetadata | undefined;
  projectId: string | undefined;
}) => {
  const { metadata, projectId } = input;
  if (!projectId) return [];

  return (metadata?.routes ?? []).map((route) => ({
    resource: createDashboardExtensionRouteResource({ projectId, route }),
  }));
};
