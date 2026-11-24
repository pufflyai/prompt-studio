import { type WorkbenchWidgetPlacement, workbenchPanelMenuRegions } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";
import { replaceViewerHost } from "./viewer-host-continuity";

const companions = (core: WorkbenchCore, owner: WorkbenchWidgetPlacement) => {
  const layout = core.layout.getLayout();
  return Object.values(workbenchPanelMenuRegions).flatMap((sides) =>
    Object.values(sides).flatMap((region) =>
      layout.regions[region].widgets.flatMap((placement) => {
        const widget = core.layout.getWidget(placement.contributionId);
        if (widget?.panelMenuOwner?.contributionId !== owner.contributionId) return [];
        if (placement.menuOwnerWidgetId && placement.menuOwnerWidgetId !== owner.widgetId) return [];
        const config = widget.config;
        const contextId =
          config && typeof config === "object" && "viewContextId" in config ? config.viewContextId : widget.rendererId;
        return [{ placement, signature: JSON.stringify([contextId, placement.viewId]) }];
      }),
    ),
  );
};

/** Page and portable-tab contributions differ, but their companion guests remain live. */
export const captureViewerMenuHosts = (core: WorkbenchCore, source?: WorkbenchWidgetPlacement) => {
  const previous = source
    ? companions(core, source).map((menu) => ({
        ...menu,
        open: core.panelMenuState.isOpen(`panel-menu:${menu.placement.widgetId}`),
      }))
    : [];
  return (destination?: WorkbenchWidgetPlacement) => {
    if (!source?.viewId || source.viewId !== destination?.viewId) return;
    const next = companions(core, destination);
    for (const menu of previous) {
      const match = next.find((candidate) => candidate.signature === menu.signature);
      if (!match) continue;
      replaceViewerHost(core, menu.placement, match.placement);
      core.panelMenuState.setOpen(`panel-menu:${match.placement.widgetId}`, menu.open);
    }
  };
};
