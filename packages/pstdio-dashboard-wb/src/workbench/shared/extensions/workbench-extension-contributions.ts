import type { DashboardExtensionMetadata, ExtensionMenuContribution } from "@pstdio/sdk/api";
import {
  buildWorkbenchExtensionMenuRegistrations,
  buildWorkbenchExtensionNavigationSections,
  buildWorkbenchExtensionRouteEntries,
  emptyWorkbenchExtensionMetadata,
  type WorkbenchExtensionMenuSlotConfig,
  type WorkbenchExtensionRoute,
} from "pstdio-extensions/workbench";
import {
  type ResourceRef,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-workbench/core";

export const dashboardExtensionRouteKind = "extension-route";
export const projectSidebarNavSlotId = "project.sidebarNav";
export const projectHeaderPrimarySlotId = "project.headerPrimary";
export const projectHeaderOverflowSlotId = "project.headerOverflow";
export const projectCommandPanelSlotId = "project.commandPanel";
export const dashboardActiveResourceKindContextKey = "dashboard.activeResource.kind";
export const dashboardActiveResourceIdContextKey = "dashboard.activeResource.id";
export const dashboardActiveResourceMetadataContextKey = (key: string) => `dashboard.activeResource.metadata.${key}`;

export type DashboardExtensionRoute = WorkbenchExtensionRoute;

export const emptyDashboardExtensionMetadata = emptyWorkbenchExtensionMetadata;

const metadataByProjectId = new Map<string, DashboardExtensionMetadata>();

export const setCachedDashboardExtensionMetadata = (projectId: string, metadata: DashboardExtensionMetadata) => {
  metadataByProjectId.set(projectId, metadata);
};

export const clearCachedDashboardExtensionMetadata = (projectId: string | undefined) => {
  if (projectId) metadataByProjectId.delete(projectId);
};

export const getCachedDashboardExtensionMetadata = (projectId: string | undefined) =>
  projectId ? metadataByProjectId.get(projectId) : undefined;

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

const extensionNavigationSectionId = (group: string) => `extension-navigation-group:${group}`;

export const buildDashboardExtensionNavigationSections = (input: {
  metadata: DashboardExtensionMetadata;
  projectId: string;
}) =>
  buildWorkbenchExtensionNavigationSections({
    metadata: input.metadata,
    slotId: projectSidebarNavSlotId,
    createSectionId: extensionNavigationSectionId,
    createResource: ({ navigation, route }) =>
      createDashboardExtensionRouteResource({ projectId: input.projectId, route, icon: navigation?.icon }),
  });

const menuSlotsById = new Map<string, WorkbenchExtensionMenuSlotConfig>([
  [projectHeaderPrimarySlotId, { menuPath: workbenchTopHeaderTrailingMenuPath, group: "primary" }],
  [
    projectHeaderOverflowSlotId,
    { menuPath: workbenchTopHeaderTrailingMenuPath, group: "overflow", overflowLabel: "Extension actions" },
  ],
  [projectCommandPanelSlotId, { menuPath: workbenchCommandPaletteMenuPath }],
]);

const createWorkbenchExtensionCommandId = (contribution: ExtensionMenuContribution) =>
  `dashboard.extension.menu.${contribution.id}`;

const isContextPrimitive = (value: unknown) =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const contextValue = (value: string | number | boolean) => JSON.stringify(String(value));

const buildDashboardWorkbenchWhenExpression = (contribution: ExtensionMenuContribution) => {
  const when = contribution.when;
  if (!when) return undefined;

  const resourceTypeTerms =
    when.resourceType?.map(
      (resourceType) => `${dashboardActiveResourceKindContextKey} == ${contextValue(resourceType)}`,
    ) ?? [];
  const metadataTerms = Object.entries(when.metadata ?? {})
    .filter((entry): entry is [string, string | number | boolean] => isContextPrimitive(entry[1]))
    .map(([key, value]) => `${dashboardActiveResourceMetadataContextKey(key)} == ${contextValue(value)}`);

  if (resourceTypeTerms.length === 0) return metadataTerms.join(" && ") || undefined;

  return resourceTypeTerms.map((term) => [term, ...metadataTerms].join(" && ")).join(" || ");
};

export const buildDashboardExtensionMenuRegistrations = (metadata: DashboardExtensionMetadata) =>
  buildWorkbenchExtensionMenuRegistrations({
    metadata,
    menuSlotsById,
    createCommandId: createWorkbenchExtensionCommandId,
    createWhenExpression: buildDashboardWorkbenchWhenExpression,
  });

export const buildDashboardExtensionRouteEntries = (input: {
  metadata: DashboardExtensionMetadata | undefined;
  projectId: string | undefined;
}) => {
  const { metadata, projectId } = input;
  if (!projectId) return [];

  return buildWorkbenchExtensionRouteEntries({
    metadata,
    navigationSlotId: projectSidebarNavSlotId,
    createResource: ({ route }) => createDashboardExtensionRouteResource({ projectId, route }),
  });
};
