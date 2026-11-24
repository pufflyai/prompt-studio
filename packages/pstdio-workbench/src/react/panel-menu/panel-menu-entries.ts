import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { workbenchPanelMenuRegions } from "../../core";
import { resolvePanelMenuRegionState } from "./panel-menu-placements";

export const panelMenuKey = (widgetId: string) => `panel-menu:${widgetId}`;
export const resolvePanelMenuEntries = (workbench: WorkbenchCore, panel: WorkbenchPanelRegion) =>
  Object.entries(workbenchPanelMenuRegions[panel]).flatMap(([side, region]) => {
    const state = resolvePanelMenuRegionState(workbench, region);
    const selected = state.widgets.find((entry) => entry.widgetId === state.activeWidgetId) ?? state.widgets[0];
    return state.widgets.flatMap((placement) => {
      const widget = workbench.layout.getWidget(placement.contributionId);
      if (!widget) return [];
      const config = widget.config;
      const id =
        config && typeof config === "object" && "viewContextId" in config && typeof config.viewContextId === "string"
          ? config.viewContextId
          : widget.id;
      return [
        {
          id,
          region,
          side,
          placement,
          key: panelMenuKey(placement.widgetId),
          selected: selected?.widgetId === placement.widgetId,
          title: widget.title,
          icon: widget.icon ?? `Panel${side === "left" ? "Left" : "Right"}Open`,
        },
      ];
    });
  });
export type PanelMenuEntry = ReturnType<typeof resolvePanelMenuEntries>[number];
