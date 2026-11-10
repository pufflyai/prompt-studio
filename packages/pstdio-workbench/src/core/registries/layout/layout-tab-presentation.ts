import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "./layout-types";

const isLiveTab = (tab: WorkbenchWidgetPlacement["tab"]) =>
  typeof tab?.getSnapshot === "function" && !tab.isDisposed?.();

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
) => {
  let regions = layout.regions;
  for (const [id, region] of Object.entries(layout.regions)) {
    let widgets = region.widgets;
    for (const [index, placement] of region.widgets.entries()) {
      const registered = isLiveTab(placement.tab) ? placement.tab : getTab(placement.contributionId);
      const tab = isLiveTab(registered) ? registered : undefined;
      if (tab === placement.tab) continue;
      if (widgets === region.widgets) widgets = [...widgets];
      widgets[index] = { ...placement, tab };
    }
    if (widgets === region.widgets) continue;
    regions = { ...regions, [id]: { ...region, widgets } };
  }
  return regions === layout.regions ? layout : { ...layout, regions };
};
