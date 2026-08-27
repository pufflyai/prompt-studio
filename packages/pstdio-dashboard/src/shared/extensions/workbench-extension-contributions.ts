import { workbenchResourceKindDefinitions } from "@pstdio/sdk/extensions";
import {
  type MenuItem,
  type MenuPath,
  resourceContextMenuPath,
  workbenchCommandPaletteMenuPath,
  workbenchResourceKindContextKey,
  workbenchResourceMetadataContextKey,
  workbenchTopHeaderTrailingMenuPath,
  workbenchViewIdContextKey,
} from "@pstdio/workbench";
import {
  buildWorkbenchExtensionCommandPaletteRegistrations,
  buildWorkbenchExtensionMenuRegistrations,
  emptyWorkbenchExtensionMetadata,
  type WorkbenchExtensionMenuSlotConfig,
} from "@pstdio/workbench/extensions";
import type { ResolvedWorkbenchExtensionMetadata } from "./extension-localization";
import { resolveLocalizableString } from "./extension-localization";

export const projectCommandPanelSlotId = "project.commandPanel";
export const dashboardActiveResourceKindContextKey = "dashboard.activeResource.kind";
export const dashboardActiveResourceIdContextKey = "dashboard.activeResource.id";
export const dashboardActiveResourceMetadataContextKey = (key: string) => `dashboard.activeResource.metadata.${key}`;

export type DashboardExtensionMetadata = ResolvedWorkbenchExtensionMetadata;
type ExtensionMenuContribution = DashboardExtensionMetadata["menuContributions"][number];
type ExtensionWhenExpression = NonNullable<ExtensionMenuContribution["when"]>;
type ResourceScopedMenuContribution = {
  slotId: string;
  when?: { resourceType?: string[] };
};
type WorkbenchMenuResult = ReturnType<typeof buildWorkbenchExtensionMenuRegistrations>;
type BaseDashboardExtensionMenuRegistration = WorkbenchMenuResult["registrations"][number];
type DashboardExtensionMenuRegistration = Omit<BaseDashboardExtensionMenuRegistration, "menuPath" | "menuItem"> & {
  menuItems: { menuPath: MenuPath; menuItem: MenuItem }[];
};

export const emptyDashboardExtensionMetadata = emptyWorkbenchExtensionMetadata as DashboardExtensionMetadata;

const metadataByProjectId = new Map<string, DashboardExtensionMetadata>();

export const setCachedDashboardExtensionMetadata = (projectId: string, metadata: DashboardExtensionMetadata) => {
  metadataByProjectId.set(projectId, metadata);
};

export const clearCachedDashboardExtensionMetadata = (projectId: string | undefined) => {
  if (!projectId) return;
  metadataByProjectId.delete(projectId);
};

export const getCachedDashboardExtensionMetadata = (projectId: string | undefined) =>
  projectId ? metadataByProjectId.get(projectId) : undefined;

type ResourceKindMenuMetadata = Pick<DashboardExtensionMetadata["resourceKinds"][number], "id" | "label" | "menuSlots">;

const hostResourceKinds = Object.values(workbenchResourceKindDefinitions) as ResourceKindMenuMetadata[];

const menuSlotConfig = (
  resourceKind: ResourceKindMenuMetadata,
  slot: NonNullable<ResourceKindMenuMetadata["menuSlots"]>[number],
): WorkbenchExtensionMenuSlotConfig => {
  if (slot.placement === "context-menu") {
    return {
      menuPath: resourceContextMenuPath(resourceKind.id),
      group: "overflow",
      overflowLabel: slot.label ?? `${resourceKind.label ?? "Resource"} actions`,
    };
  }
  if (slot.placement === "header-primary") {
    return { menuPath: workbenchTopHeaderTrailingMenuPath, group: "primary" };
  }
  return {
    menuPath: workbenchTopHeaderTrailingMenuPath,
    group: "overflow",
    overflowLabel: slot.label ?? `${resourceKind.label ?? "Resource"} actions`,
  };
};

export const buildDashboardMenuSlotRegistry = (metadata: DashboardExtensionMetadata) => {
  const menuSlotsById = new Map<string, WorkbenchExtensionMenuSlotConfig>([
    [projectCommandPanelSlotId, { menuPath: workbenchCommandPaletteMenuPath }],
  ]);
  const resourceKindsBySlotId = new Map<string, string>();
  const resourceKinds = [...hostResourceKinds, ...metadata.resourceKinds];

  for (const resourceKind of resourceKinds) {
    for (const slot of resourceKind.menuSlots ?? []) {
      const slotId = `${resourceKind.id}.${slot.id}`;
      menuSlotsById.set(slotId, menuSlotConfig(resourceKind, slot));
      resourceKindsBySlotId.set(slotId, resourceKind.id);
    }
  }

  return { menuSlotsById, resourceKindsBySlotId };
};

export const dashboardMenuTargetsById = new Map<string, WorkbenchExtensionMenuSlotConfig>([
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

export const buildDashboardWorkbenchWhenExpression = (when: ExtensionMenuContribution["when"]) => {
  if (!when) return undefined;

  const resourceTypeTerms =
    when.resourceType?.map((resourceType) => `${workbenchResourceKindContextKey} == ${contextValue(resourceType)}`) ??
    [];
  const metadataTerms = Object.entries(when.metadata ?? {})
    .filter((entry): entry is [string, string | number | boolean] => isContextPrimitive(entry[1]))
    .map(([key, value]) => `${workbenchResourceMetadataContextKey(key)} == ${contextValue(value)}`);
  const activeModeTerms = modeTerms(when.mode);
  const viewTerms = modeTerms(when.viewId).map((term) =>
    term.replace("activeWorkbenchMode", workbenchViewIdContextKey),
  );

  const modeBranches = activeModeTerms.length > 0 ? activeModeTerms : [undefined];
  const resourceBranches = resourceTypeTerms.length > 0 ? resourceTypeTerms : [undefined];
  const viewBranches = viewTerms.length > 0 ? viewTerms : [undefined];

  return modeBranches
    .flatMap((modeTerm) =>
      resourceBranches.flatMap((resourceTerm) =>
        viewBranches.map((viewTerm) =>
          [modeTerm, resourceTerm, viewTerm, ...metadataTerms].filter(Boolean).join(" && "),
        ),
      ),
    )
    .filter(Boolean)
    .join(" || ");
};

const contextMenuResourceKinds = (
  contribution: ResourceScopedMenuContribution,
  resourceKindsBySlotId: ReadonlyMap<string, string>,
) => {
  const resourceTypes = contribution.when?.resourceType ?? [];
  if (resourceTypes.length > 0) return resourceTypes;

  const slotResourceKind = resourceKindsBySlotId.get(contribution.slotId);
  return slotResourceKind && slotResourceKind !== "project" ? [slotResourceKind] : [];
};

const resourceMenuRegistrations = (
  registration: BaseDashboardExtensionMenuRegistration,
  resourceKindsBySlotId: ReadonlyMap<string, string>,
) =>
  contextMenuResourceKinds(registration.contribution, resourceKindsBySlotId).map((resourceKind) => ({
    menuPath: resourceContextMenuPath(resourceKind),
    menuItem: { ...registration.menuItem },
  }));

export const buildDashboardExtensionMenuRegistrations = (metadata: DashboardExtensionMetadata) => {
  const { menuSlotsById, resourceKindsBySlotId } = buildDashboardMenuSlotRegistry(metadata);
  const result = buildWorkbenchExtensionMenuRegistrations({
    metadata,
    menuSlotsById,
    menuTargetsById: dashboardMenuTargetsById,
    createCommandId: createWorkbenchExtensionCommandId,
    resolveString: resolveLocalizableString,
    createWhenExpression: (contribution) => {
      const resourceKind = contribution.target ? undefined : resourceKindsBySlotId.get(contribution.slotId);
      const defaultWhen =
        resourceKind && resourceKind !== "project"
          ? `${workbenchResourceKindContextKey} == ${contextValue(resourceKind)}`
          : undefined;
      const contributionWhen = buildDashboardWorkbenchWhenExpression(contribution.when);
      return [defaultWhen, contributionWhen].filter(Boolean).join(" && ") || undefined;
    },
  });
  const registrations = result.registrations.map((registration): DashboardExtensionMenuRegistration => {
    const resourceMenuItems = resourceMenuRegistrations(registration, resourceKindsBySlotId);
    const { menuItem, menuPath, ...rest } = registration;
    return {
      ...rest,
      menuItems: resourceMenuItems.length > 0 ? resourceMenuItems : [{ menuPath, menuItem }],
    };
  });
  return { registrations, unresolved: result.unresolved, menuSlotsById };
};

export const buildDashboardExtensionCommandPaletteRegistrations = (metadata: DashboardExtensionMetadata) =>
  buildWorkbenchExtensionCommandPaletteRegistrations({
    metadata,
    createCommandId: createWorkbenchExtensionPaletteCommandId,
    resolveString: resolveLocalizableString,
  });
