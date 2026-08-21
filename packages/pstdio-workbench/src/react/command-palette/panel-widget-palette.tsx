import type { PaletteEntry } from "@pstdio/ui";
import { type WorkbenchCore, workbenchPanelRegions } from "../../core";
import { getPanelLabel, openPanelWidget } from "../region/panel-widget-open";
import { WorkbenchIcon } from "../shared/icon";
import type { WorkbenchCompositionPanelsByRegion } from "../shared/use-workbench-composition-panels";
import { COMMAND_MODE_ID } from "./palette-view";

export const createWorkbenchPanelWidgetPaletteEntries = (input: {
  workbench: WorkbenchCore;
  onClose: () => void;
  panelsByRegion?: WorkbenchCompositionPanelsByRegion;
}) => {
  const { onClose, panelsByRegion, workbench } = input;
  const resource = workbench.getPrimaryResource();
  return workbenchPanelRegions.flatMap((region) =>
    (panelsByRegion?.[region] ?? workbench.composition.panelsFor(region)).addable.map((panel): PaletteEntry => {
      const widget = panel.contribution;
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
          openPanelWidget({ workbench, widget, region, resource, pinned: panel.pinned });
        },
      };
    }),
  );
};
