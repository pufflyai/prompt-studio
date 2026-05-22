import type { WorkbenchArea, WorkbenchCore } from "../../core";

// Panel areas the workbench chrome can collapse and reveal.
export type WorkbenchPanelAreaId = "left" | "main-left" | "main-right" | "main-bottom";

export const resolvePanelCollapsible = (workbench: WorkbenchCore, ...areas: WorkbenchArea[]) =>
  areas.every((area) => workbench.layout.getAreaCollapsible(area));

// Opening or closing a panel is two writes kept in lockstep: the panels
// controller owns the open flag, the layout model owns area visibility.
export const setWorkbenchPanelOpen = (workbench: WorkbenchCore, area: WorkbenchPanelAreaId, open: boolean) => {
  workbench.panels.setOpen(area, open);
  workbench.layout.setAreaVisible(area, open);
};
