import type { ResourceRef, WorkbenchLayout, WorkbenchPageContribution, WorkbenchPanelRegion } from "../../../core";
import { resolvePageActivePlacement } from "../../../core/registries/pages/page-active-placement";

export const resolveTreeActiveResource = (
  layout: WorkbenchLayout,
  page: WorkbenchPageContribution | undefined,
  primary: ResourceRef | undefined,
  region: WorkbenchPanelRegion = "main",
) => {
  const overlay = layout.regions.overlay;
  const overlayResource = (
    overlay.widgets.find((entry) => entry.widgetId === overlay.activeWidgetId) ?? overlay.widgets[0]
  )?.resource;
  if (overlayResource) return overlayResource;
  // Collection pages select their own content, independently of the routed primary.
  const active = resolvePageActivePlacement(layout, page, undefined, region);
  if (active?.resource) return active.resource;
  return primary;
};
