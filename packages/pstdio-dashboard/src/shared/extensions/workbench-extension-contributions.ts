import {
  type CommandParamSchema,
  type MenuItem,
  type MenuPath,
  type ResourceRef,
  resourceContextMenuPath,
  type TreeNode,
  type TreeViewSection,
  workbenchCommandPaletteMenuPath,
  workbenchResourceKindContextKey,
  workbenchResourceMetadataContextKey,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-workbench/core";
import {
  buildWorkbenchExtensionCommandPaletteRegistrations,
  buildWorkbenchExtensionMenuRegistrations,
  emptyWorkbenchExtensionMetadata,
  type WorkbenchExtensionMenuSlotConfig,
} from "pstdio-workbench/extensions";
import type { ResolvedWorkbenchExtensionMetadata } from "./extension-localization";
import { resolveLocalizableString } from "./extension-localization";

export const dashboardExtensionRouteKind = "extension-route";
export const projectHeaderPrimarySlotId = "project.headerPrimary";
export const projectHeaderOverflowSlotId = "project.headerOverflow";
export const projectCommandPanelSlotId = "project.commandPanel";
export const workspaceHeaderPrimarySlotId = "workspace.headerPrimary";
export const workspaceHeaderOverflowSlotId = "workspace.headerOverflow";
export const ticketHeaderPrimarySlotId = "ticket.headerPrimary";
export const ticketHeaderOverflowSlotId = "ticket.headerOverflow";
export const dashboardActiveResourceKindContextKey = "dashboard.activeResource.kind";
export const dashboardActiveResourceIdContextKey = "dashboard.activeResource.id";
export const dashboardActiveResourceMetadataContextKey = (key: string) => `dashboard.activeResource.metadata.${key}`;

export type DashboardExtensionMetadata = ResolvedWorkbenchExtensionMetadata;
export type DashboardExtensionRoute = DashboardExtensionMetadata["routes"][number];
type ExtensionMenuContribution = DashboardExtensionMetadata["menuContributions"][number];
type ExtensionTreeItemContribution = NonNullable<DashboardExtensionMetadata["treeItems"]>[number];
type ExtensionWhenExpression = NonNullable<ExtensionMenuContribution["when"]>;
type ResourceScopedMenuContribution = {
  slotId: string;
  when?: { resourceType?: string[] };
};
type DashboardExtensionMenuRegistration = ReturnType<typeof buildWorkbenchExtensionMenuRegistrations>[number] & {
  contextMenuItems: { menuPath: MenuPath; menuItem: MenuItem }[];
};

export const emptyDashboardExtensionMetadata = emptyWorkbenchExtensionMetadata as DashboardExtensionMetadata;

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
    label: resolveLocalizableString(route.label, route.extensionId),
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
  [ticketHeaderPrimarySlotId, { menuPath: workbenchTopHeaderTrailingMenuPath, group: "primary" }],
  [
    ticketHeaderOverflowSlotId,
    { menuPath: workbenchTopHeaderTrailingMenuPath, group: "overflow", overflowLabel: "Ticket actions" },
  ],
]);

const defaultMenuSlotWhenById = new Map<string, string>([
  [workspaceHeaderPrimarySlotId, `${workbenchResourceKindContextKey} == "workspace"`],
  [workspaceHeaderOverflowSlotId, `${workbenchResourceKindContextKey} == "workspace"`],
  [ticketHeaderPrimarySlotId, `${workbenchResourceKindContextKey} == "ticket"`],
  [ticketHeaderOverflowSlotId, `${workbenchResourceKindContextKey} == "ticket"`],
]);

const menuSlotResourceKindById = new Map<string, string>([
  [workspaceHeaderPrimarySlotId, "workspace"],
  [workspaceHeaderOverflowSlotId, "workspace"],
  [ticketHeaderPrimarySlotId, "ticket"],
  [ticketHeaderOverflowSlotId, "ticket"],
]);

const menuTargetsById = new Map<string, WorkbenchExtensionMenuSlotConfig>([
  ["workbench.nav.actions", { menuPath: workbenchTopHeaderTrailingMenuPath, group: "primary" }],
  [
    "workbench.nav.overflow",
    { menuPath: workbenchTopHeaderTrailingMenuPath, group: "overflow", overflowLabel: "Extension actions" },
  ],
  ["workbench.top.actions", { menuPath: workbenchTopHeaderTrailingMenuPath, group: "primary" }],
  [
    "workbench.top.overflow",
    { menuPath: workbenchTopHeaderTrailingMenuPath, group: "overflow", overflowLabel: "Extension actions" },
  ],
  ["workbench.commandPalette", { menuPath: workbenchCommandPaletteMenuPath }],
]);

const createWorkbenchExtensionCommandId = (contribution: { id: string }) =>
  `dashboard.extension.menu.${contribution.id}`;

const createWorkbenchExtensionPaletteCommandId = (contribution: { id: string }) =>
  `dashboard.extension.palette.${contribution.id}`;

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
    when.resourceType?.map((resourceType) => `${workbenchResourceKindContextKey} == ${contextValue(resourceType)}`) ??
    [];
  const metadataTerms = Object.entries(when.metadata ?? {})
    .filter((entry): entry is [string, string | number | boolean] => isContextPrimitive(entry[1]))
    .map(([key, value]) => `${workbenchResourceMetadataContextKey(key)} == ${contextValue(value)}`);
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

// Parameters the dashboard resolves from the active resource at execution time must not
// be surfaced as user input fields. The backend command handlers read these from
// `ctx.resource` (e.g. the planner's resolveTicket falls back to ctx.resource.id), so the
// action modal only asks for genuine input (agent/model, repo, template, context).
const resourceResolvedParamKeys = new Set([
  "ticket",
  "ticketId",
  "ticketShorthand",
  "rowId",
  "workspaceId",
  "workspace",
  "workspaceShorthand",
  "sessionId",
]);

const stripResourceResolvedParams = (params: CommandParamSchema | undefined) => {
  if (!params) return params;
  const userFacing = Object.entries(params).filter(([key]) => !resourceResolvedParamKeys.has(key));
  return userFacing.length > 0 ? Object.fromEntries(userFacing) : undefined;
};

const contextMenuResourceKinds = (contribution: ResourceScopedMenuContribution) => {
  const resourceTypes = contribution.when?.resourceType ?? [];
  if (resourceTypes.length > 0) return resourceTypes;

  const slotResourceKind = menuSlotResourceKindById.get(contribution.slotId);
  return slotResourceKind ? [slotResourceKind] : [];
};

const contextMenuRegistrations = (registration: ReturnType<typeof buildWorkbenchExtensionMenuRegistrations>[number]) =>
  contextMenuResourceKinds(registration.contribution).map((resourceKind) => ({
    menuPath: resourceContextMenuPath(resourceKind),
    menuItem: { ...registration.menuItem },
  }));

export const buildDashboardExtensionMenuRegistrations = (metadata: DashboardExtensionMetadata) =>
  buildWorkbenchExtensionMenuRegistrations({
    metadata,
    menuSlotsById,
    menuTargetsById,
    createCommandId: createWorkbenchExtensionCommandId,
    resolveString: resolveLocalizableString,
    createWhenExpression: (contribution) => {
      const defaultWhen = contribution.target ? undefined : defaultMenuSlotWhenById.get(contribution.slotId);
      const contributionWhen = buildDashboardWorkbenchWhenExpression(contribution.when);
      return [defaultWhen, contributionWhen].filter(Boolean).join(" && ") || undefined;
    },
  }).map(
    (registration): DashboardExtensionMenuRegistration => ({
      ...registration,
      command: { ...registration.command, params: stripResourceResolvedParams(registration.command.params) },
      contextMenuItems: contextMenuRegistrations(registration),
    }),
  );

export const buildDashboardExtensionCommandPaletteRegistrations = (metadata: DashboardExtensionMetadata) =>
  buildWorkbenchExtensionCommandPaletteRegistrations({
    metadata,
    createCommandId: createWorkbenchExtensionPaletteCommandId,
    resolveString: resolveLocalizableString,
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
      label: resolveLocalizableString(item.label, item.extensionId),
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
    label: resolveLocalizableString(item.label, item.extensionId),
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
