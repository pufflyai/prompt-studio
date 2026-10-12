import type { WorkbenchLayout } from "../layout/layout-types";
import type { WorkbenchPageContribution } from "./page-registry";

export const resolvePageActivePlacement = (layout: WorkbenchLayout, page?: WorkbenchPageContribution) => {
  if (page?.main.kind !== "panels") return;
  const main = layout.regions.main;
  const selected = main.widgets.find((entry) => entry.widgetId === main.activeWidgetId) ?? main.widgets[0];
  return selected?.placementIdentity?.kind === "page" && selected.placementIdentity.pageId === page.id
    ? selected
    : undefined;
};

export const resolvePageBreadcrumbPlacement = (layout: WorkbenchLayout, page?: WorkbenchPageContribution) =>
  page?.resource ? undefined : resolvePageActivePlacement(layout, page);
