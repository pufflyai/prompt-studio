import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../layout/layout-types";
import type { WorkbenchPageContribution } from "./page-registry";
import { pageResourceContextKey } from "./page-resource-context";

export const resolvePageActivePlacement = (
  layout: WorkbenchLayout,
  page?: WorkbenchPageContribution,
  ownsPlacement?: (placement: WorkbenchWidgetPlacement) => boolean,
) => {
  if (!page) return;
  const main = layout.regions.main;
  const selected = main.widgets.find((entry) => entry.widgetId === main.activeWidgetId) ?? main.widgets[0];
  return selected &&
    (ownsPlacement?.(selected) ||
      (selected.placementIdentity?.kind === "page" && selected.placementIdentity.pageId === page.id))
    ? selected
    : undefined;
};

export const resolvePageBreadcrumbPlacement = (
  layout: WorkbenchLayout,
  page?: WorkbenchPageContribution,
  resource?: ResourceRef,
  ownsPlacement?: (placement: WorkbenchWidgetPlacement) => boolean,
) => {
  const placement = resolvePageActivePlacement(layout, page, ownsPlacement);
  if (page?.resource && pageResourceContextKey(page, placement?.resource) !== pageResourceContextKey(page, resource))
    return;
  return placement;
};
