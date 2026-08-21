import type { WorkbenchRegion } from "@pstdio/workbench";
import { createWorkbenchCompositionRegistry, toPanelPlacements } from "@pstdio/workbench/extensions";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { extensionViewWidgetIdFor } from "./extension-view-placement";

type ExtensionPanelRecord = DashboardExtensionMetadata["panels"][number];
type ExtensionModeRecord = DashboardExtensionMetadata["modes"][number];
type ExtensionModePlacement = NonNullable<ExtensionModeRecord["modePanels"]>[string];
type ExtensionModeRecipe = NonNullable<ExtensionModeRecord["resources"]>[string];

export interface ResourcePanelBinding {
  panel: ExtensionPanelRecord;
  slot?: string;
  region: WorkbenchRegion;
  required: boolean;
  pinned?: boolean;
}

const panelPlacements = (panel: ExtensionPanelRecord | undefined) => {
  if (!panel?.show) return [];
  return Array.isArray(panel.show) ? panel.show : [panel.show];
};

const widgetIdsByPanelId = (panels: readonly ExtensionPanelRecord[]) =>
  new Map(panels.map((panel) => [panel.id, extensionViewWidgetIdFor(panel)]));

const widgetIdOf = (panelId: string, widgetIds: Map<string, string>) => widgetIds.get(panelId) ?? panelId;

const toWidgetPlacements = (
  placements: Record<string, ExtensionModePlacement> | undefined,
  widgetIds: Map<string, string>,
) =>
  placements
    ? Object.fromEntries(
        Object.entries(placements).map(([panelId, placement]) => [widgetIdOf(panelId, widgetIds), placement]),
      )
    : undefined;

const toWidgetRecipes = (resources: Record<string, ExtensionModeRecipe> | undefined, widgetIds: Map<string, string>) =>
  resources
    ? Object.fromEntries(
        Object.entries(resources).map(([resourceKind, recipe]) => [
          resourceKind,
          { slots: recipe.slots, panels: toWidgetPlacements(recipe.panels, widgetIds) },
        ]),
      )
    : undefined;

// The dashboard registers extension panel widgets under its own widget-id scheme, and
// the composition resolver places panels by opening the ids it was given. So the
// composition it sees speaks widget ids while the manifest speaks panel ids.
export const createExtensionCompositionRegistry = (metadata: DashboardExtensionMetadata) => {
  const widgetIds = widgetIdsByPanelId(metadata.panels);
  const registry = createWorkbenchCompositionRegistry();
  const isChrome = (panelId: string) => {
    const panel = metadata.panels.find((candidate) => candidate.id === panelId);
    return Boolean(panel && isExtensionResourceSidenavView(metadata, panel));
  };

  for (const kind of metadata.resourceKinds ?? []) {
    registry.registerResourceKind({
      id: kind.id,
      extensionId: kind.extensionId,
      surface: kind.surface,
      slots: kind.slots,
    });
  }
  for (const panel of metadata.panels) {
    if (isChrome(panel.id)) continue;
    registry.registerPanelCapability({
      id: widgetIdOf(panel.id, widgetIds),
      extensionId: panel.extensionId,
      title: panel.title,
      icon: panel.icon,
      show: toPanelPlacements(panel.show),
    });
  }
  for (const edge of metadata.resourcePanels ?? []) {
    if (isChrome(edge.panel)) continue;
    registry.registerResourcePanel({
      id: edge.id,
      extensionId: edge.extensionId,
      resourceKind: edge.resourceKind,
      panel: widgetIdOf(edge.panel, widgetIds),
      slot: edge.slot,
    });
  }
  for (const mode of metadata.modes) {
    registry.registerModeComposition({
      id: mode.modeId,
      extensionId: mode.extensionId,
      resources: toWidgetRecipes(mode.resources, widgetIds),
      modePanels: toWidgetPlacements(mode.modePanels, widgetIds),
    });
  }

  return registry;
};

// The mode that owns a resource kind: the one whose recipe places the kind's panels.
export const resourceModeFor = (metadata: DashboardExtensionMetadata, resourceKind: string, modeId?: string) =>
  metadata.modes.find((mode) => mode.modeId === modeId && Boolean(mode.resources?.[resourceKind])) ??
  metadata.modes.find((mode) => Boolean(mode.resources?.[resourceKind]));

// A panel owned by the resource extension carries its default placement. Slot edges
// stay only for cross-extension contributions and use the target mode's slot recipe.
export const resourcePanelBindings = (
  metadata: DashboardExtensionMetadata,
  resourceKind: string,
  modeId?: string,
): ResourcePanelBinding[] => {
  const panelById = new Map(metadata.panels.map((panel) => [panel.id, panel]));
  const kind = metadata.resourceKinds?.find((candidate) => candidate.id === resourceKind);
  const recipe = resourceModeFor(metadata, resourceKind, modeId)?.resources?.[resourceKind];
  const own = metadata.panels.flatMap((panel) =>
    panel.extensionId === kind?.extensionId
      ? panelPlacements(panel)
          .filter((placement) => placement.for === resourceKind)
          .map((placement) => {
            const policy = recipe?.panels?.[panel.id] ?? placement;
            return {
              panel,
              region: policy.region,
              required: policy.required ?? placement.required ?? false,
              pinned: "pinned" in policy ? policy.pinned : undefined,
            };
          })
      : [],
  );
  const external = (metadata.resourcePanels ?? [])
    .filter((edge) => edge.resourceKind === resourceKind)
    .flatMap((edge) => {
      const panel = panelById.get(edge.panel);
      if (!panel) return [];
      const slotPlacement = panel.extensionId === kind?.extensionId ? recipe?.slots?.[edge.slot] : undefined;
      const placement = recipe?.panels?.[edge.panel] ?? slotPlacement;
      const fallback = panelPlacements(panel)[0];
      if (!placement && !fallback) return [];
      return [
        {
          panel,
          slot: edge.slot,
          region: placement?.region ?? fallback?.region ?? "main",
          required: placement?.required ?? fallback?.required ?? false,
          pinned: placement?.pinned,
        },
      ];
    });
  return [...own, ...external];
};

const resourcePanelBinding = (
  metadata: DashboardExtensionMetadata,
  resourceKind: string | undefined,
  panelId: string,
) =>
  resourceKind
    ? resourcePanelBindings(metadata, resourceKind).find((binding) => binding.panel.id === panelId)
    : undefined;

// The resource kind a panel serves comes from its owned placement or resource-panel edge.
export const panelResourceKind = (metadata: DashboardExtensionMetadata, panelId: string) =>
  panelPlacements(metadata.panels.find((panel) => panel.id === panelId)).find((placement) => placement.for)?.for ??
  (metadata.resourcePanels ?? []).find((edge) => edge.panel === panelId)?.resourceKind;

// A resource tree the recipe docks in the sidenav is dashboard navigation chrome: it
// renders through the sidenav contribution, so it owns no docked widget and must stay
// out of the composition the resolver places.
export const isSidenavResourceTree = (binding: ResourcePanelBinding) =>
  binding.panel.renderer?.kind === "tree" && binding.region === "sidenav";

export const resourceSidenavModeId = (
  metadata: DashboardExtensionMetadata,
  panel: Pick<ExtensionPanelRecord, "id">,
) => {
  const resourceKind = panelResourceKind(metadata, panel.id);
  const binding = resourcePanelBinding(metadata, resourceKind, panel.id);
  if (!resourceKind || !binding || !isSidenavResourceTree(binding)) return undefined;
  return resourceModeFor(metadata, resourceKind)?.modeId ?? "project";
};

export const isExtensionResourceSidenavView = (
  metadata: DashboardExtensionMetadata,
  panel: Pick<ExtensionPanelRecord, "id">,
) => Boolean(resourceSidenavModeId(metadata, panel));

// The resource kinds this metadata OWNS. Contributions register one extension at a
// time, and a resource kind has exactly one owner: the extension that declared it. An
// extension contributing a panel into another extension's open slot must not also
// claim that kind's resource presenter, or registering the owner fails and the owner
// loses every contribution it declared.
export const compositionResourceKinds = (metadata: DashboardExtensionMetadata) =>
  (metadata.resourceKinds ?? []).map((kind) => kind.id);

// The panels one mode can place: mode-wide entries, resource panel overrides, and the
// panels bound to the slots its resource recipes place.
const modePlacedPanelIds = (metadata: DashboardExtensionMetadata, mode: ExtensionModeRecord) => {
  const panelIds = new Set(Object.keys(mode.modePanels ?? {}));
  for (const [resourceKind, recipe] of Object.entries(mode.resources ?? {})) {
    for (const panel of metadata.panels) {
      if (panelPlacements(panel).some((placement) => placement.for === resourceKind)) panelIds.add(panel.id);
    }
    for (const panelId of Object.keys(recipe.panels ?? {})) panelIds.add(panelId);
    const slots = new Set(Object.keys(recipe.slots ?? {}));
    const edges = (metadata.resourcePanels ?? []).filter(
      (edge) => edge.resourceKind === resourceKind && slots.has(edge.slot),
    );
    for (const edge of edges) panelIds.add(edge.panel);
  }
  return panelIds;
};

export const modeIdsByPanelId = (metadata: DashboardExtensionMetadata) => {
  const modeIds = new Map<string, string[]>();
  for (const mode of metadata.modes) {
    for (const panelId of modePlacedPanelIds(metadata, mode)) {
      modeIds.set(panelId, [...(modeIds.get(panelId) ?? []), mode.modeId]);
    }
  }
  return modeIds;
};
