import { workbenchPanelRegions } from "../layout/layout-regions";
import type { WorkbenchLayout } from "../layout/layout-types";
import type { WorkbenchPageContribution } from "./page-registry";

export const resolvePageActivePlacement = (layout: WorkbenchLayout, page?: WorkbenchPageContribution) => {
  if (page?.main.kind !== "panels") return;
  const selected = workbenchPanelRegions
    .flatMap((id) => {
      const region = layout.regions[id];
      return region.widgets.find((entry) => entry.widgetId === region.activeWidgetId) ?? region.widgets[0] ?? [];
    })
    .filter((entry) => entry.placementIdentity?.kind === "page" && entry.placementIdentity.pageId === page.id);
  return selected.find((entry) => entry.widgetId === layout.activeWidgetId) ?? selected.find((entry) => entry.resource);
};
