import { workbenchPanelMenuRegions } from "../../registries/layout/layout-regions";
import type { WorkbenchCore } from "../../workbench-core-types";
import { readMenuHeaderSettings } from "./menu-header-settings";

/** Select a companion locally without changing the owning view, command resource or focus. */
export const selectViewMenuPlacement = (core: WorkbenchCore, widgetId: string) => {
  const layout = core.layout.getLayout();
  const region = Object.values(workbenchPanelMenuRegions)
    .flatMap((sides) => Object.values(sides))
    .find((region) => layout.regions[region].widgets.some((widget) => widget.widgetId === widgetId));
  if (!region || layout.regions[region].activeWidgetId === widgetId) return;
  core.layout.restoreLayout({
    ...layout,
    regions: { ...layout.regions, [region]: { ...layout.regions[region], activeWidgetId: widgetId } },
  });
};

export const openOwnedViewMenu = (core: WorkbenchCore, ownerWidgetId: string, menuId: string) => {
  const layout = core.layout.getLayout();
  const owner =
    core.pages.getContent()?.widgetId === ownerWidgetId
      ? core.pages.getContent()
      : Object.values(layout.regions)
          .flatMap((region) => region.widgets)
          .find((widget) => widget.widgetId === ownerWidgetId);
  if (!owner) return;
  const menus = Object.values(workbenchPanelMenuRegions)
    .flatMap((sides) => Object.values(sides))
    .flatMap((region) =>
      layout.regions[region].widgets
        .filter((widget) => widget.menuOwnerWidgetId === ownerWidgetId)
        .map((placement) => ({ region, placement })),
    );
  const target = menus.find(({ placement }) => {
    const config = core.layout.getWidget(placement.contributionId)?.config;
    return config && typeof config === "object" && "viewContextId" in config && config.viewContextId === menuId;
  });
  if (!target) return;
  const settings = readMenuHeaderSettings(
    core,
    owner.viewId ?? core.layout.getWidget(owner.contributionId)?.rendererId ?? "",
  );
  const closing = menus.filter(
    (menu) =>
      (!settings.multipleMenus || menu.region === target.region) && core.layout.getRegionCollapsible(menu.region),
  );
  core.panelMenuState.setSelection(
    closing.map((menu) => `panel-menu:${menu.placement.widgetId}`),
    `panel-menu:${target.placement.widgetId}`,
  );
  selectViewMenuPlacement(core, target.placement.widgetId);
};
