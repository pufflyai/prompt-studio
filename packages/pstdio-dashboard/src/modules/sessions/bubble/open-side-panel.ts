import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

// Sessions belong to the project's mode, which starts once the project's rows have synced.
const projectModeStarted = (workbench: WorkbenchModuleContext) =>
  new Promise<void>((resolve) => {
    if (workbench.modes.getActiveModeId()) return resolve();
    const unsubscribe = workbench.modes.store.subscribe(() => {
      if (!workbench.modes.getActiveModeId()) return;
      unsubscribe();
      resolve();
    });
  });

export const openDashboardSidePanel = async (workbench: WorkbenchModuleContext) => {
  await projectModeStarted(workbench);
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
