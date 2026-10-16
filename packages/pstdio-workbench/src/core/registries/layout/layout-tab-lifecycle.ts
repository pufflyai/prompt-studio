import { getActivePlacement, removeLocationSubPanelSelection, replaceRegionWidgets } from "./layout-operations";
import type { WorkbenchLayout, WorkbenchTabPosition, WorkbenchWidgetPlacement } from "./layout-types";
import { planTrayPlacement } from "./tray-tabs";

export const placeWidget = (
  widgets: WorkbenchWidgetPlacement[],
  placement: WorkbenchWidgetPlacement,
  position?: WorkbenchTabPosition,
) => {
  return planTrayPlacement(widgets, placement, position).widgets;
};

export const reorderWidgetPlacement = (
  widgets: WorkbenchWidgetPlacement[],
  widgetId: string,
  position: WorkbenchTabPosition,
) => {
  const placement = widgets.find((candidate) => candidate.widgetId === widgetId);
  if (!placement) return widgets;
  const remaining = widgets.filter((candidate) => candidate.widgetId !== widgetId);
  return planTrayPlacement(remaining, placement, position).widgets;
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
    nextLayout = { ...nextLayout, activeWidgetId: undefined, activeResourceKey: undefined };
  }
  return nextLayout;
};

export const expirePreviewTabsInLayout = (layout: WorkbenchLayout, ownerResourceKey?: string) =>
  removePlacements(
    layout,
    (placement) =>
      placement.tabRetention === "preview" &&
      (ownerResourceKey === undefined || placement.ownerResourceKey !== ownerResourceKey),
  );
