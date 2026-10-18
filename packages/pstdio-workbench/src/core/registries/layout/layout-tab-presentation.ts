import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "./layout-types";

const mapPlacements = (
  layout: WorkbenchLayout,
  map: (placement: WorkbenchWidgetPlacement) => WorkbenchWidgetPlacement,
) => ({
  ...layout,
  regions: Object.fromEntries(
    Object.entries(layout.regions).map(([id, region]) => [id, { ...region, widgets: region.widgets.map(map) }]),
  ) as WorkbenchLayout["regions"],
});

// Presentation providers belong to registered contributions. JSON snapshots
// store placement data only; restoring must attach the current live provider.
export const cacheLayoutData = (layout: WorkbenchLayout) =>
  mapPlacements(layout, ({ tab: _tab, ...placement }) => placement);

export const restoreLayoutPresentation = (
  layout: WorkbenchLayout,
  getTab: (contributionId: string) => WorkbenchWidgetPlacement["tab"],
) =>
  mapPlacements(layout, (placement) => ({
    ...placement,
    tab: typeof placement.tab?.getSnapshot === "function" ? placement.tab : getTab(placement.contributionId),
  }));
