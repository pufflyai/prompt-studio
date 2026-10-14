import { contributionRefId } from "@pstdio/sdk/extensions";
import type { LayoutModel } from "../layout/layout-model";
import { pagePlacementContributionId } from "../views/view-placement";
import type { WorkbenchViewRegistry } from "../views/view-registry";
import type { WorkbenchPageContribution } from "./page-registry-types";

export const pagePanelMenus = (page: WorkbenchPageContribution) =>
  (["left", "right"] as const).flatMap((side) => {
    const menu = page.panelMenus?.[side];
    return menu ? [{ ...menu, side, slotId: `$menu-${side}`, region: `main-${side}-menu` as const }] : [];
  });

export const registerPagePanelMenus = (
  page: WorkbenchPageContribution,
  layout: LayoutModel,
  views: WorkbenchViewRegistry,
) =>
  pagePanelMenus(page).map((menu) => {
    const view = views.getView(contributionRefId(menu.view));
    if (!view) throw new Error(`Page menu view is not registered: ${page.id}.${menu.slotId}`);
    return layout.registerWidget({
      id: pagePlacementContributionId(page.id, menu.slotId),
      title: view.title,
      icon: view.icon,
      rendererId: view.id,
      region: menu.region,
      singleton: true,
      closable: false,
      regionSize: menu.size,
      regionCollapsible: menu.collapsible,
      hiddenByDefault: menu.hiddenByDefault,
    });
  });
