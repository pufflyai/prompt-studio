import type { WorkbenchRegion, WorkbenchWidgetPlacement } from "../../core";

export const toTabKey = (regionId: string, placement: WorkbenchWidgetPlacement) =>
  `${regionId}:${placement.contributionId}`;

// A lone pinned, non-closable sidenav panel offers no tab interaction — there is nothing to
// switch to or close — so the sidenav renders it without a tab strip.
export const suppressesSidenavTabStrip = (region: WorkbenchRegion, placements: WorkbenchWidgetPlacement[]) =>
  region === "sidenav" && placements.length === 1 && placements[0]!.pinned === true && placements[0]!.closable !== true;

// A Sub Panel tab presents its widget; the resource on its placement only binds
// it to a Location. Location and content tabs present the resource they show.
export const resolveTabIconName = (
  placement: WorkbenchWidgetPlacement,
  widget: { icon?: string } | undefined,
  resourceKindIcon: string | undefined,
) => {
  const resourceIcon = placement.resource?.icon ?? resourceKindIcon;
  if (placement.role === "sub-panel") return widget?.icon ?? resourceIcon;
  return resourceIcon ?? widget?.icon;
};

export const resolveDisplayedActiveWidgetId = (
  visiblePlacements: WorkbenchWidgetPlacement[],
  activeWidgetId: string | undefined,
): string | undefined => {
  if (!activeWidgetId) return visiblePlacements[0]?.widgetId;
  const hasActive = visiblePlacements.some((placement) => placement.widgetId === activeWidgetId);
  if (hasActive) return activeWidgetId;
  return visiblePlacements[0]?.widgetId;
};
