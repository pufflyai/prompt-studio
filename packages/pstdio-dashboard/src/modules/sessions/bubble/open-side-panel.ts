import { contributionRefId, sessionBrowser } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";

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
  const viewId = contributionRefId(sessionBrowser.views.conversation);
  const active = workbench.layout.getActivePanel("side");
  const session =
    active?.viewId === viewId
      ? active
      : workbench.layout.listPanelInstances("side").find((panel) => panel.viewId === viewId);
  if (session) {
    workbench.layout.activatePanel(session.instanceId);
  } else {
    await workbench.commands.executeCommand(
      dashboardCommandIds.createSession,
      { sidePanel: true },
      { resource: workbench.getPrimaryResource() },
    );
  }
  workbench.sidePanel.setMode("floating");
};
