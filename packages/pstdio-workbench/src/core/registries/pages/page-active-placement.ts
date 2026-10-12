import type { WorkbenchLayout } from "../layout/layout-types";
import type { WorkbenchPageContribution } from "./page-registry";

export const resolvePageActivePlacement = (layout: WorkbenchLayout, page?: WorkbenchPageContribution) => {
  if (page?.main.kind !== "panels" || page.resource) return;
  const main = layout.regions.main;
  const selected = main.widgets.find((entry) => entry.widgetId === main.activeWidgetId) ?? main.widgets[0];
  return selected?.placementIdentity?.kind === "page" && selected.placementIdentity.pageId === page.id
    ? selected
    : undefined;
};
