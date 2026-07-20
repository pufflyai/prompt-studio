import type { WorkbenchWidgetPlacement } from "../../core";

export const toTabKey = (regionId: string, placement: WorkbenchWidgetPlacement) =>
  `${regionId}:${placement.contributionId}`;

export const resolveDisplayedActiveWidgetId = (
  visiblePlacements: WorkbenchWidgetPlacement[],
  activeWidgetId: string | undefined,
): string | undefined => {
  if (!activeWidgetId) return visiblePlacements[0]?.widgetId;
  const hasActive = visiblePlacements.some((placement) => placement.widgetId === activeWidgetId);
  if (hasActive) return activeWidgetId;
  return visiblePlacements[0]?.widgetId;
};
