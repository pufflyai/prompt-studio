import type {
  OpenWidgetInput,
  RegisteredWidgetContribution,
  WorkbenchArea,
  WorkbenchAreaState,
  WorkbenchLayout,
  WorkbenchWidgetPlacement,
} from "./layout-types";

export const findPlacement = (layout: WorkbenchLayout, contributionId: string) => {
  for (const area of Object.values(layout.areas)) {
    const index = area.widgets.findIndex((candidate) => candidate.contributionId === contributionId);
    if (index >= 0) return { areaId: area.id, index, placement: area.widgets[index] };
  }
  return undefined;
};

export const findPlacementByWidgetId = (layout: WorkbenchLayout, widgetId: string) => {
  for (const area of Object.values(layout.areas)) {
    const index = area.widgets.findIndex((candidate) => candidate.widgetId === widgetId);
    if (index >= 0) return { areaId: area.id, index, placement: area.widgets[index] };
  }
  return undefined;
};

export const getActivePlacement = (area: WorkbenchAreaState) =>
  area.widgets.find((placement) => placement.widgetId === area.activeWidgetId) ?? area.widgets[0];

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
  closable: spec.closable ?? widget.closable ?? false,
});

interface ReplaceAreaWidgetsOptions {
  activeWidgetId?: string;
  clearActiveWidget?: boolean;
}

export const replaceAreaWidgets = (
  layout: WorkbenchLayout,
  areaId: WorkbenchArea,
  update: (widgets: WorkbenchWidgetPlacement[]) => WorkbenchWidgetPlacement[],
  options: ReplaceAreaWidgetsOptions = {},
): WorkbenchLayout => {
  const area = layout.areas[areaId];
  const widgets = update(area.widgets);
  const activeWidgetId =
    options.activeWidgetId !== undefined
      ? options.activeWidgetId
      : options.clearActiveWidget
        ? undefined
        : area.activeWidgetId;

  return {
    ...layout,
    areas: {
      ...layout.areas,
      [areaId]: { ...area, widgets, activeWidgetId },
    },
  };
};

export const removePlacementsForContribution = (layout: WorkbenchLayout, contributionId: string): WorkbenchLayout => {
  let nextLayout = layout;

  for (const area of Object.values(layout.areas)) {
    const filtered = area.widgets.filter((placement) => placement.contributionId !== contributionId);
    if (filtered.length === area.widgets.length) continue;
    const activeWidgetId =
      area.activeWidgetId && !filtered.some((placement) => placement.widgetId === area.activeWidgetId)
        ? undefined
        : area.activeWidgetId;
    nextLayout = {
      ...nextLayout,
      areas: {
        ...nextLayout.areas,
        [area.id]: { ...area, widgets: filtered, activeWidgetId },
      },
    };
  }

  const hasActiveWidget = Object.values(nextLayout.areas).some((area) =>
    area.widgets.some((placement) => placement.widgetId === nextLayout.activeWidgetId),
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

  const area = layout.areas[found.areaId];
  const widgets = area.widgets.filter((placement) => placement.widgetId !== widgetId);
  const closingEffectiveActive = area.activeWidgetId === widgetId || (!area.activeWidgetId && found.index === 0);
  const nextActivePlacement = widgets[found.index] ?? widgets[found.index - 1];
  const activeWidgetId = closingEffectiveActive ? nextActivePlacement?.widgetId : area.activeWidgetId;
  const nextArea = { ...area, widgets, activeWidgetId };
  let nextLayout: WorkbenchLayout = {
    ...layout,
    areas: {
      ...layout.areas,
      [area.id]: nextArea,
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
    areaId: found.areaId,
    closedPlacement: found.placement,
    activePlacement: getActivePlacement(nextArea),
    layout: nextLayout,
  };
};

export const activateInLayout = (
  layout: WorkbenchLayout,
  areaId: WorkbenchArea,
  placement: WorkbenchWidgetPlacement,
): WorkbenchLayout => {
  const area = layout.areas[areaId];
  return {
    ...layout,
    activeWidgetId: placement.widgetId,
    activeResourceUri: placement.resourceUri,
    areas: {
      ...layout.areas,
      [areaId]: { ...area, activeWidgetId: placement.widgetId },
    },
  };
};
