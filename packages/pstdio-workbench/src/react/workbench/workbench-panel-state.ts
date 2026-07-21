import type { WorkbenchCore, WorkbenchPanelMenuRegion, WorkbenchRegion } from "../../core";

// Panel regions the workbench chrome can collapse and reveal.
export type WorkbenchPanelRegionId = "sidebar" | "secondary" | WorkbenchPanelMenuRegion;

export const resolvePanelCollapsible = (workbench: WorkbenchCore, ...regions: WorkbenchRegion[]) =>
  regions.every((region) => workbench.layout.getRegionCollapsible(region));

// Opening or closing a panel is two writes kept in lockstep: the panels
// controller owns the open flag, the layout model owns region visibility.
export const setWorkbenchPanelOpen = (workbench: WorkbenchCore, region: WorkbenchPanelRegionId, open: boolean) => {
  workbench.panels.setOpen(region, open);
  workbench.layout.setRegionVisible(region, open);
};
