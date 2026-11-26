import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { selectOwnedPanelMenus } from "../../registries/layout/owned-panel-menu-selection";

export const syncOwnedPanelMenus = (
  layout: LayoutModel,
  pageContent: WorkbenchWidgetPlacement | undefined,
  getPanelMenuOpen?: (widgetId: string) => boolean | undefined,
) => {
  const before = layout.getLayout();
  const active = new Set(Object.values(before.regions).map((region) => region.activeWidgetId));
  if (pageContent) active.add(pageContent.widgetId);
  const ownedPlacements = [
    ...Object.values(before.regions).flatMap((region) => region.widgets),
    ...(pageContent ? [pageContent] : []),
  ].filter((placement) => Boolean(placement.placementIdentity));
  const selections: { owner: string; opened: string[] }[] = [];
  for (const placement of ownedPlacements) {
    const owner = layout.getWidget(placement.contributionId);
    const opened: string[] = [];
    for (const menuId of owner?.ownedPanelMenuIds ?? []) {
      const menu = layout.getWidget(menuId);
      if (!menu) continue;
      const menuPlacement = layout.openWidget(menuId, {
        pinned: true,
        role: "panel-menu",
        menuOwnerWidgetId: placement.widgetId,
        viewId: menu.rendererId,
        resource: placement.resource,
        pageContext: placement.pageContext ?? placement.pageOwnerLocation,
        title: menu.region.endsWith("-left-menu") ? placement.resource?.label : menu.title,
      });
      opened.push(menuPlacement.widgetId);
    }
    if (active.has(placement.widgetId)) selections.push({ owner: placement.widgetId, opened });
  }
  const current = layout.getLayout();
  let selected = current;
  for (const { owner, opened } of selections)
    selected = selectOwnedPanelMenus(before, selected, owner, opened, (id) => layout.getWidget(id), getPanelMenuOpen);
  if (selected !== current) layout.restoreLayout(selected);
  layout.reconcilePanelMenus();
};
