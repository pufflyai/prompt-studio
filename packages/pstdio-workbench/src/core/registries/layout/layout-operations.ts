import type {
  OpenWidgetInput,
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchRegion,
  WorkbenchRegionState,
  WorkbenchWidgetPlacement,
} from "./layout-types";
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
  if (update.tab !== undefined) next.tab = update.tab;
  if (update.ownerId !== undefined) next.ownerId = update.ownerId;
  if (update.source !== undefined) next.source = update.source;
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
  tab: spec.tab ?? widget.tab,
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
    regions: {
      ...layout.regions,
      [regionId]: { ...region, widgets, activeWidgetId },
    },
  };
};

export const removePlacementsForContribution = (layout: WorkbenchLayout, contributionId: string): WorkbenchLayout => {
  let nextLayout = layout;

  for (const region of Object.values(layout.regions)) {
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

  return nextLayout;
};

export const closeWidgetInLayout = (layout: WorkbenchLayout, widgetId: string) => {
  const found = findPlacementByWidgetId(layout, widgetId);
  if (!found) return undefined;

  const region = layout.regions[found.regionId];
  const widgets = region.widgets.filter((placement) => placement.widgetId !== widgetId);
  const closingEffectiveActive = region.activeWidgetId === widgetId || (!region.activeWidgetId && found.index === 0);
  const nextActivePlacement = widgets[found.index] ?? widgets[found.index - 1];
  const activeWidgetId = closingEffectiveActive ? nextActivePlacement?.widgetId : region.activeWidgetId;
  const nextRegion = { ...region, widgets, activeWidgetId };
  let nextLayout: WorkbenchLayout = {
    ...layout,
    regions: {
      ...layout.regions,
      [region.id]: nextRegion,
    },
  };

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
  return {
    ...layout,
    activeWidgetId: placement.widgetId,
    activeResourceUri: placement.resourceUri,
    regions: {
      ...layout.regions,
      [regionId]: { ...region, activeWidgetId: placement.widgetId },
    },
  };
};
