import type {
  OpenWidgetInput,
  RegisteredWidgetContribution,
  ShellArea,
  ShellAreaState,
  ShellLayout,
  ShellWidgetPlacement,
} from "./layout-types";

export const findPlacement = (layout: ShellLayout, contributionId: string) => {
  for (const area of Object.values(layout.areas)) {
    const index = area.widgets.findIndex((candidate) => candidate.contributionId === contributionId);
    if (index >= 0) return { areaId: area.id, index, placement: area.widgets[index] };
  }
  return undefined;
};

export const getActivePlacement = (area: ShellAreaState) =>
  area.widgets.find((placement) => placement.widgetId === area.activeWidgetId) ?? area.widgets[0];

export const buildUpdatedPlacement = (
  placement: ShellWidgetPlacement,
  widget: RegisteredWidgetContribution,
  update: OpenWidgetInput,
): ShellWidgetPlacement => {
  const next: ShellWidgetPlacement = { ...placement };
  if (update.resource) {
    next.resource = update.resource;
    next.resourceUri = update.resource.uri;
    next.title = update.title ?? update.resource.label ?? widget.title;
  } else if (update.title !== undefined) {
    next.title = update.title;
  }
  if (update.pinned !== undefined) next.pinned = update.pinned;
  if (update.closable !== undefined) next.closable = update.closable;
  return next;
};

export const createPlacement = (
  widgetId: string,
  widget: RegisteredWidgetContribution,
  spec: OpenWidgetInput,
): ShellWidgetPlacement => ({
  widgetId,
  contributionId: widget.id,
  resource: spec.resource,
  resourceUri: spec.resource?.uri,
  title: spec.title ?? spec.resource?.label ?? widget.title,
  pinned: spec.pinned,
  closable: spec.closable ?? true,
});

interface ReplaceAreaWidgetsOptions {
  activeWidgetId?: string;
  clearActiveWidget?: boolean;
}

export const replaceAreaWidgets = (
  layout: ShellLayout,
  areaId: ShellArea,
  update: (widgets: ShellWidgetPlacement[]) => ShellWidgetPlacement[],
  options: ReplaceAreaWidgetsOptions = {},
): ShellLayout => {
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

export const removePlacementsForContribution = (layout: ShellLayout, contributionId: string): ShellLayout => {
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

export const activateInLayout = (
  layout: ShellLayout,
  areaId: ShellArea,
  placement: ShellWidgetPlacement,
): ShellLayout => {
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
