import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";

export const openDashboardSidePanel = async (workbench: WorkbenchModuleContext) => {
  if (workbench.layout.listPanelInstances("side").length === 0) {
    await workbench.commands.executeCommand(dashboardCommandIds.createSession);
  }
  workbench.sidePanel.setMode("floating");
};
