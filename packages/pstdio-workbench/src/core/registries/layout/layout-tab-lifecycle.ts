import { getActivePlacement, removeLocationSubPanelSelection, replaceRegionWidgets } from "./layout-operations";
import type { WorkbenchLayout, WorkbenchTabPosition, WorkbenchWidgetPlacement } from "./layout-types";

const insertAtPosition = (
  widgets: WorkbenchWidgetPlacement[],
  placement: WorkbenchWidgetPlacement,
  position: WorkbenchTabPosition = "end",
) => {
  const next = [...widgets];
  if (position === "start") {
    next.unshift(placement);
    return next;
  }
  if (position === "end") {
    next.push(placement);
    return next;
  }

  const targetWidgetId = "beforeWidgetId" in position ? position.beforeWidgetId : position.afterWidgetId;
  const targetIndex = next.findIndex((candidate) => candidate.widgetId === targetWidgetId);
  if (targetIndex < 0) {
    next.push(placement);
    return next;
  }
  next.splice(targetIndex + ("afterWidgetId" in position ? 1 : 0), 0, placement);
  return next;
};

export const placeWidget = (
  widgets: WorkbenchWidgetPlacement[],
  placement: WorkbenchWidgetPlacement,
  position?: WorkbenchTabPosition,
) => {
  if (placement.tabRetention !== "preview") return insertAtPosition(widgets, placement, position);
  const persistentWidgets = widgets.filter(
    (candidate) => candidate.tabRetention !== "preview" && candidate.widgetId !== placement.widgetId,
  );
  return insertAtPosition(persistentWidgets, placement, "start");
};

export const reorderWidgetPlacement = (
  widgets: WorkbenchWidgetPlacement[],
  widgetId: string,
  position: WorkbenchTabPosition,
) => {
  const placement = widgets.find((candidate) => candidate.widgetId === widgetId);
  if (!placement) return widgets;
  if (placement.tabRetention === "preview") {
    throw new Error(`Preview widget cannot be reordered: ${widgetId}`);
  }
  const remaining = widgets.filter((candidate) => candidate.widgetId !== widgetId);
  return insertAtPosition(remaining, placement, position);
};

const removePlacements = (layout: WorkbenchLayout, shouldRemove: (placement: WorkbenchWidgetPlacement) => boolean) => {
  let nextLayout = layout;

  for (const region of Object.values(layout.regions)) {
    const removed = region.widgets.filter(shouldRemove);
    if (removed.length === 0) continue;
    const active = getActivePlacement(region);
    nextLayout = replaceRegionWidgets(
      nextLayout,
      region.id,
      (widgets) => widgets.filter((placement) => !shouldRemove(placement)),
      { clearActiveWidget: active ? shouldRemove(active) : false },
    );
    for (const placement of removed) {
      nextLayout = removeLocationSubPanelSelection(nextLayout, placement.widgetId);
    }
  }

  const activePlacement = nextLayout.activeWidgetId
    ? Object.values(nextLayout.regions)
        .flatMap((region) => region.widgets)
        .find((placement) => placement.widgetId === nextLayout.activeWidgetId)
    : undefined;
  if (!activePlacement) {
    nextLayout = { ...nextLayout, activeWidgetId: undefined, activeResourceUri: undefined };
  }
  return nextLayout;
};

export const expirePreviewTabsInLayout = (layout: WorkbenchLayout, ownerResourceUri?: string) =>
  removePlacements(
    layout,
    (placement) =>
      placement.tabRetention === "preview" &&
      (ownerResourceUri === undefined || placement.ownerResourceUri !== ownerResourceUri),
  );

export const withoutPreviewTabs = (layout: WorkbenchLayout) =>
  removePlacements(layout, (placement) => placement.tabRetention === "preview");
