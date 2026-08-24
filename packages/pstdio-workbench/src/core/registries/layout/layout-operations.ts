import type {
  OpenWidgetInput,
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchRegion,
  WorkbenchRegionState,
  WorkbenchWidgetPlacement,
} from "./layout-types";
import { workbenchPanelRegions } from "./layout-types";
import { resolveUniqueWidgetId } from "./widget-id";

export const findPlacement = (layout: WorkbenchLayout, contributionId: string) => {
  for (const region of Object.values(layout.regions)) {
    const index = region.widgets.findIndex((candidate) => candidate.contributionId === contributionId);
    if (index >= 0) return { regionId: region.id, index, placement: region.widgets[index] };
  }
  return undefined;
};

export const findResourcePlacement = (layout: WorkbenchLayout, contributionId: string, resourceUri: string) => {
  for (const region of Object.values(layout.regions)) {
    const index = region.widgets.findIndex(
      (candidate) => candidate.contributionId === contributionId && candidate.resourceUri === resourceUri,
    );
    if (index >= 0) return { regionId: region.id, index, placement: region.widgets[index] };
  }
  return undefined;
};

export const findPlacementByWidgetId = (layout: WorkbenchLayout, widgetId: string) => {
  for (const region of Object.values(layout.regions)) {
    const index = region.widgets.findIndex((candidate) => candidate.widgetId === widgetId);
    if (index >= 0) return { regionId: region.id, index, placement: region.widgets[index] };
  }
  return undefined;
};

export const createUniqueWidgetId = (layout: WorkbenchLayout, contributionId: string) => {
  const widgetIds = new Set(
    Object.values(layout.regions).flatMap((region) => region.widgets.map((placement) => placement.widgetId)),
  );
  return resolveUniqueWidgetId(widgetIds, contributionId);
};

export const getActivePlacement = (region: WorkbenchRegionState) =>
  region.widgets.find((placement) => placement.widgetId === region.activeWidgetId) ?? region.widgets[0];

const isLocationPlacement = (placement: WorkbenchWidgetPlacement) => placement.role === "location";

export const locationWorkspaceKey = (placement: WorkbenchWidgetPlacement) =>
  placement.resourceUri ?? `${placement.contributionId}:${placement.widgetId}`;

export const setLocationSubPanelSelection = (
  layout: WorkbenchLayout,
  location: WorkbenchWidgetPlacement | undefined,
  region: WorkbenchPanelRegion,
  widgetId: string | undefined,
) => {
  if (!location) return layout;
  const key = locationWorkspaceKey(location);
  const current = layout.locationSubPanelSelections?.[key] ?? {};
  const next = { ...current };
  if (widgetId) next[region] = widgetId;
  else delete next[region];
  return {
    ...layout,
    locationSubPanelSelections: {
      ...layout.locationSubPanelSelections,
      [key]: next,
    },
  };
};

export const removeLocationSubPanelSelection = (layout: WorkbenchLayout, widgetId: string) => {
  if (!layout.locationSubPanelSelections) return layout;
  const locationSubPanelSelections = Object.fromEntries(
    Object.entries(layout.locationSubPanelSelections).map(([key, selections]) => [
      key,
      Object.fromEntries(Object.entries(selections).filter(([, selectedId]) => selectedId !== widgetId)),
    ]),
  ) as WorkbenchLayout["locationSubPanelSelections"];
  return { ...layout, locationSubPanelSelections };
};

export const getActiveLocationPlacement = (layout: WorkbenchLayout) => {
  const locations = layout.regions.main.widgets.filter(isLocationPlacement);
  return locations.find((placement) => placement.widgetId === layout.activeLocationWidgetId) ?? locations.at(-1);
};

export const buildUpdatedPlacement = (
  placement: WorkbenchWidgetPlacement,
  widget: RegisteredWidgetContribution,
  update: OpenWidgetInput,
): WorkbenchWidgetPlacement => {
  const next: WorkbenchWidgetPlacement = { ...placement };
  if (update.resource) {
    next.resource = update.resource;
    next.resourceUri = update.resource.uri;
    next.title = update.title ?? update.resource.label ?? widget.title;
  } else if (update.title !== undefined) {
    next.title = update.title;
  }
  if (update.pinned !== undefined) next.pinned = update.pinned;
  if (update.closable !== undefined) next.closable = update.closable;
  if (update.mountStrategy !== undefined) next.mountStrategy = update.mountStrategy;
  if (update.hiddenByDefault !== undefined) next.hiddenByDefault = update.hiddenByDefault;
  if (update.tabRetention !== undefined) next.tabRetention = update.tabRetention;
  if (update.tab !== undefined) next.tab = update.tab;
  if (update.ownerId !== undefined) next.ownerId = update.ownerId;
  if (update.source !== undefined) next.source = update.source;
  if (update.role !== undefined) next.role = update.role;
  return next;
};

export const createPlacement = (
  widgetId: string,
  widget: RegisteredWidgetContribution,
  spec: OpenWidgetInput,
): WorkbenchWidgetPlacement => ({
  widgetId,
  contributionId: widget.id,
  ownerId: spec.ownerId ?? widget.ownerId,
  source: spec.source ?? widget.source,
  resource: spec.resource,
  resourceUri: spec.resource?.uri,
  title: spec.title ?? spec.resource?.label ?? widget.title,
  pinned: spec.pinned,
  // Tabbed (non-singleton) widgets are closable unless they opt out; singleton
  // panels stay non-closable by default.
  closable: spec.closable ?? widget.closable ?? !widget.singleton,
  mountStrategy: spec.mountStrategy ?? widget.mountStrategy,
  hiddenByDefault: spec.hiddenByDefault ?? widget.hiddenByDefault,
  tabRetention: spec.tabRetention,
  tab: spec.tab ?? widget.tab,
  role: spec.role ?? "content",
});

interface ReplaceRegionWidgetsOptions {
  activeWidgetId?: string;
  clearActiveWidget?: boolean;
}

export const replaceRegionWidgets = (
  layout: WorkbenchLayout,
  regionId: WorkbenchRegion,
  update: (widgets: WorkbenchWidgetPlacement[]) => WorkbenchWidgetPlacement[],
  options: ReplaceRegionWidgetsOptions = {},
): WorkbenchLayout => {
  const region = layout.regions[regionId];
  const widgets = update(region.widgets);
  const activeWidgetId =
    options.activeWidgetId !== undefined
      ? options.activeWidgetId
      : options.clearActiveWidget
        ? undefined
        : region.activeWidgetId;

  return {
    ...layout,
    activeLocationWidgetId:
      regionId === "main" && !widgets.some((placement) => placement.widgetId === layout.activeLocationWidgetId)
        ? widgets.filter(isLocationPlacement).at(-1)?.widgetId
        : layout.activeLocationWidgetId,
    regions: {
      ...layout.regions,
      [regionId]: { ...region, widgets, activeWidgetId },
    },
  };
};

export const removePlacementsForContribution = (layout: WorkbenchLayout, contributionId: string): WorkbenchLayout => {
  let nextLayout = layout;

  for (const region of Object.values(layout.regions)) {
    const removed = region.widgets.filter((placement) => placement.contributionId === contributionId);
    const filtered = region.widgets.filter((placement) => placement.contributionId !== contributionId);
    if (filtered.length === region.widgets.length) continue;
    const activeWidgetId =
      region.activeWidgetId && !filtered.some((placement) => placement.widgetId === region.activeWidgetId)
        ? undefined
        : region.activeWidgetId;
    nextLayout = {
      ...nextLayout,
      regions: {
        ...nextLayout.regions,
        [region.id]: { ...region, widgets: filtered, activeWidgetId },
      },
    };
    for (const placement of removed) {
      nextLayout = removeLocationSubPanelSelection(nextLayout, placement.widgetId);
    }
  }

  const hasActiveWidget = Object.values(nextLayout.regions).some((region) =>
    region.widgets.some((placement) => placement.widgetId === nextLayout.activeWidgetId),
  );

  if (
    nextLayout.activeWidgetId &&
    (!hasActiveWidget ||
      nextLayout.activeWidgetId.startsWith(`${contributionId}:`) ||
      nextLayout.activeWidgetId === contributionId)
  ) {
    nextLayout = { ...nextLayout, activeWidgetId: undefined, activeResourceUri: undefined };
  }

  if (
    nextLayout.activeLocationWidgetId &&
    !nextLayout.regions.main.widgets.some((placement) => placement.widgetId === nextLayout.activeLocationWidgetId)
  ) {
    nextLayout = {
      ...nextLayout,
      activeLocationWidgetId: nextLayout.regions.main.widgets.filter(isLocationPlacement).at(-1)?.widgetId,
    };
  }

  return nextLayout;
};

export const closeWidgetInLayout = (layout: WorkbenchLayout, widgetId: string) => {
  const found = findPlacementByWidgetId(layout, widgetId);
  if (!found) return undefined;

  const region = layout.regions[found.regionId];
  const widgets = region.widgets.filter((placement) => placement.widgetId !== widgetId);
  const closingEffectiveActive = region.activeWidgetId === widgetId || (!region.activeWidgetId && found.index === 0);
  const fallbackSubPanel =
    found.placement.role === "sub-panel"
      ? widgets.find(
          (placement) =>
            placement.role === "sub-panel" && placement.ownerResourceUri === found.placement.ownerResourceUri,
        )
      : undefined;
  const nextActivePlacement =
    fallbackSubPanel ??
    (found.placement.role === "sub-panel" && found.regionId === "main"
      ? getActiveLocationPlacement(layout)
      : (widgets[found.index] ?? widgets[found.index - 1]));
  const activeWidgetId = closingEffectiveActive ? nextActivePlacement?.widgetId : region.activeWidgetId;
  const nextRegion = { ...region, widgets, activeWidgetId };
  let nextLayout: WorkbenchLayout = removeLocationSubPanelSelection(
    {
      ...layout,
      activeLocationWidgetId:
        layout.activeLocationWidgetId === widgetId
          ? layout.regions.main.widgets
              .filter((placement) => placement.widgetId !== widgetId && isLocationPlacement(placement))
              .at(-1)?.widgetId
          : layout.activeLocationWidgetId,
      regions: {
        ...layout.regions,
        [region.id]: nextRegion,
      },
    },
    widgetId,
  );

  if (
    closingEffectiveActive &&
    found.regionId !== "side" &&
    workbenchPanelRegions.includes(found.regionId as WorkbenchPanelRegion)
  ) {
    nextLayout = setLocationSubPanelSelection(
      nextLayout,
      getActiveLocationPlacement(nextLayout),
      found.regionId as WorkbenchPanelRegion,
      nextActivePlacement?.role === "sub-panel" ? nextActivePlacement.widgetId : undefined,
    );
  }

  if (layout.activeWidgetId === widgetId) {
    nextLayout = {
      ...nextLayout,
      activeWidgetId: nextActivePlacement?.widgetId,
      activeResourceUri: nextActivePlacement?.resourceUri,
    };
  }

  return {
    regionId: found.regionId,
    closedPlacement: found.placement,
    activePlacement: getActivePlacement(nextRegion),
    layout: nextLayout,
  };
};

export const activateInLayout = (
  layout: WorkbenchLayout,
  regionId: WorkbenchRegion,
  placement: WorkbenchWidgetPlacement,
): WorkbenchLayout => {
  const region = layout.regions[regionId];
  if (regionId === "main" && isLocationPlacement(placement)) {
    const selections = layout.locationSubPanelSelections?.[locationWorkspaceKey(placement)] ?? {};
    const regions = Object.fromEntries(
      Object.entries(layout.regions).map(([id, panel]) => [
        id,
        {
          ...panel,
          widgets: panel.widgets.map((candidate) => {
            if (!placement.resource || candidate.widgetId === placement.widgetId) return candidate;
            if (candidate.ownerResourceUri !== placement.resourceUri) return candidate;
            if (candidate.resourceUri !== placement.resourceUri) return candidate;
            return { ...candidate, resource: placement.resource };
          }),
        },
      ]),
    ) as WorkbenchLayout["regions"];
    for (const panelRegion of workbenchPanelRegions) {
      const panel = regions[panelRegion];
      const selectedId = selections[panelRegion];
      const selected = panel.widgets.find(
        (candidate) =>
          candidate.widgetId === selectedId &&
          candidate.role === "sub-panel" &&
          (!candidate.ownerResourceUri || candidate.ownerResourceUri === placement.resourceUri),
      );
      regions[panelRegion] = {
        ...panel,
        activeWidgetId:
          panelRegion === "side"
            ? panel.activeWidgetId
            : (selected?.widgetId ?? (panelRegion === "main" ? placement.widgetId : undefined)),
      };
    }
    return {
      ...layout,
      activeWidgetId: placement.widgetId,
      activeLocationWidgetId: placement.widgetId,
      activeResourceUri: placement.resourceUri,
      regions,
    };
  }

  const withSelection =
    placement.role === "sub-panel" &&
    regionId !== "side" &&
    workbenchPanelRegions.includes(regionId as WorkbenchPanelRegion)
      ? setLocationSubPanelSelection(
          layout,
          getActiveLocationPlacement(layout),
          regionId as WorkbenchPanelRegion,
          placement.widgetId,
        )
      : layout;
  return {
    ...withSelection,
    activeWidgetId: placement.widgetId,
    activeLocationWidgetId: layout.activeLocationWidgetId,
    activeResourceUri: placement.resourceUri,
    regions: {
      ...withSelection.regions,
      [regionId]: { ...region, activeWidgetId: placement.widgetId },
    },
  };
};

// Selects one widget as a region's active tab. In main the selected Location tab is the
// active Location: panel menus, Sub Panel selections, and the primary resource all
// follow it, so selecting a Location without moving it would leave them on the old
// panel. Returns undefined when the selection is already current.
export const selectRegionActiveWidget = (
  layout: WorkbenchLayout,
  regionId: WorkbenchRegion,
  widgetId: string | undefined,
) => {
  const region = layout.regions[regionId];
  const placement = widgetId ? region.widgets.find((candidate) => candidate.widgetId === widgetId) : undefined;
  if (widgetId && !placement) throw new Error(`Widget placement not found in ${regionId}: ${widgetId}`);
  if (region.activeWidgetId === widgetId) return undefined;

  const followsRegion = layout.activeWidgetId === region.activeWidgetId;
  const nextLayout: WorkbenchLayout = {
    ...layout,
    activeWidgetId: followsRegion ? placement?.widgetId : layout.activeWidgetId,
    activeResourceUri: followsRegion ? placement?.resourceUri : layout.activeResourceUri,
    activeLocationWidgetId:
      regionId === "main" && placement?.role === "location" ? placement.widgetId : layout.activeLocationWidgetId,
    regions: { ...layout.regions, [regionId]: { ...region, activeWidgetId: placement?.widgetId } },
  };
  if (regionId === "side" || !workbenchPanelRegions.includes(regionId as WorkbenchPanelRegion)) return nextLayout;
  return setLocationSubPanelSelection(
    nextLayout,
    getActiveLocationPlacement(nextLayout),
    regionId as WorkbenchPanelRegion,
    placement?.role === "sub-panel" ? placement.widgetId : undefined,
  );
};
