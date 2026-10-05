import {
  getAnchorResource,
  type WorkbenchLayout,
  type WorkbenchPageContribution,
  workbenchPanelRegions,
} from "../../../core";

export const resolveTreeActiveResource = (layout: WorkbenchLayout, page?: WorkbenchPageContribution) => {
  const overlay = layout.regions.overlay;
  const overlayResource = (
    overlay.widgets.find((entry) => entry.widgetId === overlay.activeWidgetId) ?? overlay.widgets[0]
  )?.resource;
  if (overlayResource) return overlayResource;
  // Collection pages select their own content, independently of the routed primary.
  if (page?.main.kind === "panels") {
    const selected = workbenchPanelRegions
      .flatMap((id) => {
        const region = layout.regions[id];
        return region.widgets.find((entry) => entry.widgetId === region.activeWidgetId) ?? region.widgets[0] ?? [];
      })
      .filter((entry) => entry.placementIdentity?.kind === "page" && entry.placementIdentity.pageId === page.id);
    const active =
      selected.find((entry) => entry.widgetId === layout.activeWidgetId) ?? selected.find((entry) => entry.resource);
    if (active?.resource) return active.resource;
  }
  return getAnchorResource(layout, "primary");
};
