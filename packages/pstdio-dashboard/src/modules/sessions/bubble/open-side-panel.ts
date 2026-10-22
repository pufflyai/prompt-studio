import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

export const openDashboardSidePanel = async (workbench: WorkbenchModuleContext) => {
  const active = workbench.layout.getActivePanel("side");
  const session =
    active?.viewId === dashboardWidgetIds.sessionBubble
      ? active
      : workbench.layout.listPanelInstances("side").find((panel) => panel.viewId === dashboardWidgetIds.sessionBubble);
  if (session) {
    workbench.layout.activatePanel(session.instanceId);
  } else {
    await workbench.commands.executeCommand(dashboardCommandIds.createSession, { sidePanel: true });
  }
  workbench.sidePanel.setMode("floating");
};
