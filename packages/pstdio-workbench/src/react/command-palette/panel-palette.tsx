import type { PaletteEntry } from "@pstdio/ui";
import { getAnchorResource, listOpenablePanels, type WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { SEARCH_MODE_ID } from "./palette-view";

export interface WorkbenchPanelPaletteEntry extends PaletteEntry {
  panelId: string;
  mode: typeof SEARCH_MODE_ID;
}

export const createWorkbenchPanelPaletteEntries = (input: { workbench: WorkbenchCore; onClose: () => void }) => {
  const { onClose, workbench } = input;
  const frame = workbench.layout.getFrame();
  const layout = workbench.layout.getLayout();
  const primary = getAnchorResource(frame, layout, "primary");
  const widgets = workbench.layout.listWidgets();

  return Object.keys(frame.slots).flatMap((slot) =>
    listOpenablePanels({ widgets, frame, slot, primary, layout }).map(
      (panel): WorkbenchPanelPaletteEntry => ({
        id: `workbench-panel:${panel.id}`,
        panelId: panel.id,
        mode: SEARCH_MODE_ID,
        label: panel.title,
        searchText: `${panel.title} ${panel.id}`,
        group: "Panels",
        icon: <WorkbenchIcon name="PanelsTopLeft" />,
        onActivate: () => {
          onClose();
          workbench.layout.openWidget(panel.id, { area: slot, resource: primary });
        },
      }),
    ),
  );
};
