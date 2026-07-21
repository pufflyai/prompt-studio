import type { PaletteEntry } from "@pstdio/ui";
import { listEligiblePanelWidgets, type WorkbenchCore, workbenchPanelRegions } from "../../core";
import { getPanelLabel, openPanelWidget } from "../region/panel-widget-open";
import { WorkbenchIcon } from "../shared/icon";
import { COMMAND_MODE_ID } from "./palette-view";

export const createWorkbenchPanelWidgetPaletteEntries = (input: { workbench: WorkbenchCore; onClose: () => void }) => {
  const { onClose, workbench } = input;
  const resource = workbench.getPrimaryResource();
  const widgets = workbench.layout.listWidgets();
  const layout = workbench.layout.getLayout();

  return workbenchPanelRegions.flatMap((region) =>
    listEligiblePanelWidgets({ widgets, layout, region, resource }).map((widget): PaletteEntry => {
      const panelLabel = getPanelLabel(region);
      const label = `Open ${widget.title} in ${panelLabel} Panel`;

      return {
        id: `workbench-panel:${region}:${widget.id}`,
        mode: COMMAND_MODE_ID,
        label,
        searchText: `${label} ${widget.id}`,
        group: "Panels",
        icon: widget.icon ? <WorkbenchIcon name={widget.icon} /> : undefined,
        onActivate: () => {
          onClose();
          openPanelWidget({ workbench, widget, region, resource });
        },
      };
    }),
  );
};
