import type {
  MoveWidgetInput,
  OpenWidgetInput,
  RegisteredWidgetContribution,
  SlotId,
  WorkbenchAreaState,
  WorkbenchLayout,
  WorkbenchWidgetPlacement,
} from "./layout-types";

export const findPlacement = (layout: WorkbenchLayout, contributionId: string) => {
  for (const area of Object.values(layout.areas)) {
    const index = area.widgets.findIndex((candidate) => candidate.contributionId === contributionId);
    const placement = area.widgets[index];
    if (placement) return { areaId: area.id, index, placement };
  }
  return undefined;
};

export const findResourcePlacement = (layout: WorkbenchLayout, contributionId: string, resourceUri: string) => {
  for (const area of Object.values(layout.areas)) {
    const index = area.widgets.findIndex(
      (candidate) => candidate.contributionId === contributionId && candidate.resourceUri === resourceUri,
    );
    const placement = area.widgets[index];
    if (placement) return { areaId: area.id, index, placement };
  }
  return undefined;
};

export const findPlacementByWidgetId = (layout: WorkbenchLayout, widgetId: string) => {
  for (const area of Object.values(layout.areas)) {
    const index = area.widgets.findIndex((candidate) => candidate.widgetId === widgetId);
    const placement = area.widgets[index];
    if (placement) return { areaId: area.id, index, placement };
  }
  return undefined;
};

export const getActivePlacement = (area: WorkbenchAreaState | undefined) =>
  area?.widgets.find((placement) => placement.widgetId === area.activeWidgetId) ?? area?.widgets[0];

export const getActiveWidgetId = (layout: WorkbenchLayout) =>
  getActivePlacement(layout.activeSlotId ? layout.areas[layout.activeSlotId] : undefined)?.widgetId;

const insertPlacement = (widgets: WorkbenchWidgetPlacement[], placement: WorkbenchWidgetPlacement, index?: number) => {
  const next = [...widgets];
  const insertionIndex = index === undefined ? next.length : Math.max(0, Math.min(index, next.length));
  next.splice(insertionIndex, 0, placement);
  return next;
};

export const moveWidgetInLayout = (layout: WorkbenchLayout, widgetId: string, target: MoveWidgetInput) => {
  const found = findPlacementByWidgetId(layout, widgetId);
  if (!found) return undefined;

  const source = layout.areas[found.areaId];
  const targetArea = layout.areas[target.areaId];
  if (!source) return undefined;
  if (!targetArea) throw new Error(`Workbench area not found: ${target.areaId}`);

  const sourceActive = getActivePlacement(source);
  const targetActive = getActivePlacement(targetArea);
  const movingGlobalActive = getActiveWidgetId(layout) === widgetId;
  const sourceWidgets = source.widgets.filter((_placement, index) => index !== found.index);

  if (source.id === targetArea.id) {
    const nextArea = {
      ...source,
      widgets: insertPlacement(sourceWidgets, found.placement, target.index),
      activeWidgetId: sourceActive?.widgetId,
    };
    const nextLayout = {
      ...layout,
      areas: { ...layout.areas, [source.id]: nextArea },
      activeResourceUri:
        layout.activeSlotId === source.id ? getActivePlacement(nextArea)?.resourceUri : layout.activeResourceUri,
    };
    return { placement: found.placement, layout: nextLayout, sourceAreaId: source.id, targetAreaId: targetArea.id };
  }

  const sourceFallback = sourceWidgets[found.index] ?? sourceWidgets[found.index - 1];
  const nextSource = {
    ...source,
    widgets: sourceWidgets,
    activeWidgetId: sourceActive?.widgetId === widgetId ? sourceFallback?.widgetId : sourceActive?.widgetId,
  };
  const nextTarget = {
    ...targetArea,
    widgets: insertPlacement(targetArea.widgets, found.placement, target.index),
    activeWidgetId: movingGlobalActive || !targetActive ? widgetId : targetActive.widgetId,
  };
  const activeSlotId = movingGlobalActive ? targetArea.id : layout.activeSlotId;
  const areas = {
    ...layout.areas,
    [source.id]: nextSource,
    [targetArea.id]: nextTarget,
  };
  const nextLayout = {
    ...layout,
    areas,
    activeSlotId,
    activeResourceUri: activeSlotId ? getActivePlacement(areas[activeSlotId])?.resourceUri : undefined,
  };

  return { placement: found.placement, layout: nextLayout, sourceAreaId: source.id, targetAreaId: targetArea.id };
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
  if (update.companionOfPrimary !== undefined) next.companionOfPrimary = update.companionOfPrimary;
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
  companionOfPrimary: spec.companionOfPrimary,
});

interface ReplaceAreaWidgetsOptions {
  activeWidgetId?: string;
  clearActiveWidget?: boolean;
}

export const replaceAreaWidgets = (
  layout: WorkbenchLayout,
  areaId: SlotId,
  update: (widgets: WorkbenchWidgetPlacement[]) => WorkbenchWidgetPlacement[],
  options: ReplaceAreaWidgetsOptions = {},
) => {
  const area = layout.areas[areaId];
  if (!area) throw new Error(`Workbench area not found: ${areaId}`);
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

export const removePlacementsForContribution = (layout: WorkbenchLayout, contributionId: string) => {
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

  if (nextLayout.activeSlotId && !getActivePlacement(nextLayout.areas[nextLayout.activeSlotId])) {
    return { ...nextLayout, activeSlotId: undefined, activeResourceUri: undefined };
  }

  return nextLayout;
};

export const closeWidgetInLayout = (layout: WorkbenchLayout, widgetId: string) => {
  const found = findPlacementByWidgetId(layout, widgetId);
  if (!found) return undefined;

  const area = layout.areas[found.areaId];
  if (!area) return undefined;
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

  if (getActiveWidgetId(layout) === widgetId) {
    nextLayout = {
      ...nextLayout,
      activeSlotId: nextActivePlacement ? area.id : undefined,
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

export const activateInLayout = (layout: WorkbenchLayout, areaId: SlotId, placement: WorkbenchWidgetPlacement) => {
  const area = layout.areas[areaId];
  if (!area) throw new Error(`Workbench area not found: ${areaId}`);
  return {
    ...layout,
    activeSlotId: areaId,
    activeResourceUri: placement.resourceUri,
    areas: {
      ...layout.areas,
      [areaId]: { ...area, activeWidgetId: placement.widgetId },
    },
  };
};
