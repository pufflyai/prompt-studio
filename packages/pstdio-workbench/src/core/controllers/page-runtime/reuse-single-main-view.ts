import { locationWorkspaceKey } from "../../registries/layout/layout-operations";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { pageMainFamily } from "../../registries/pages/page-main-family";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";

export const reuseSingleMainView = (
  previous: WorkbenchLayout,
  layout: WorkbenchLayout,
  pages: Readonly<Record<string, WorkbenchPageContribution>>,
) => {
  const primary = (value: WorkbenchLayout) =>
    value.regions.main.widgets.find(
      (p) => p.role === "location" && p.placementIdentity?.kind === "page" && !p.declarationIdentity,
    );
  const source = primary(previous);
  const target = primary(layout);
  if (!source || !target || source.widgetId === target.widgetId) return layout;
  const sourcePage = source.placementIdentity?.kind === "page" ? pages[source.placementIdentity.pageId] : undefined;
  const targetPage = target.placementIdentity?.kind === "page" ? pages[target.placementIdentity.pageId] : undefined;
  if (!sourcePage || !targetPage) return layout;
  const family = pageMainFamily(sourcePage, pages);
  if (!family || family !== pageMainFamily(targetPage, pages) || source.viewId !== target.viewId) return layout;
  // Transfers retain their view and resource under the new owner. Reuse only
  // a live page-owned Main whose physical instance is free in the destination.
  if (Object.values(layout.regions).some((region) => region.widgets.some((p) => p.widgetId === source.widgetId)))
    return layout;
  const rebind = (id: string | undefined) => (id === target.widgetId ? source.widgetId : id);
  const rebound = { ...target, widgetId: source.widgetId };
  const oldKey = locationWorkspaceKey(target);
  const newKey = locationWorkspaceKey(rebound);
  let selections = layout.locationSubPanelSelections;
  if (selections?.[oldKey] && oldKey !== newKey) {
    const { [oldKey]: selected, ...remaining } = selections;
    selections = { ...remaining, [newKey]: selected };
  }
  return {
    ...layout,
    locationSubPanelSelections: selections,
    activeWidgetId: rebind(layout.activeWidgetId),
    activeLocationWidgetId: rebind(layout.activeLocationWidgetId),
    regions: {
      ...layout.regions,
      main: {
        ...layout.regions.main,
        activeWidgetId: rebind(layout.regions.main.activeWidgetId),
        savedWidgetOrder: layout.regions.main.savedWidgetOrder?.map((id) => rebind(id)!),
        widgets: layout.regions.main.widgets.map((p) => (p === target ? rebound : p)),
      },
    },
  };
};
