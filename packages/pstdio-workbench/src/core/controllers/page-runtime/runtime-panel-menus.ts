import type { LayoutModel } from "../../registries/layout/layout-model";

export const syncOwnedPanelMenus = (layout: LayoutModel) => {
  const ownedPlacements = Object.values(layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .filter((placement) => Boolean(placement.placementIdentity));
  for (const placement of ownedPlacements) {
    const owner = layout.getWidget(placement.contributionId);
    for (const menuId of owner?.ownedPanelMenuIds ?? []) {
      const menu = layout.getWidget(menuId);
      if (!menu) continue;
      layout.openWidget(menuId, {
        pinned: true,
        role: "panel-menu",
        viewId: menu.rendererId,
        resource: placement.resource,
        title: menu.region.endsWith("-left-menu") ? placement.resource?.label : menu.title,
      });
    }
  }
  layout.reconcilePanelMenus();
};
