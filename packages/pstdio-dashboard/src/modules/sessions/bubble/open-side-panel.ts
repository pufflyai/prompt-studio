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
  const viewId = contributionRefId(sessionBrowser.views.conversation);
  // The bubble belongs to the generic Side shell; Sessions only supplies its optional default tab.
  if (!workbench.views.getView(viewId)) {
    workbench.sidePanel.setMode("floating");
    return;
  }
  await projectModeStarted(workbench);
  const active = workbench.layout.getActivePanel("side");
  // Resource replacement can clear the instance view override without changing its
  // registered renderer. Both identify the same provider-owned conversation.
  const isSession = (panel: NonNullable<typeof active>) =>
    (panel.viewId ?? workbench.layout.getPanel(panel.panelId)?.rendererId) === viewId;
  const session = active && isSession(active) ? active : workbench.layout.listPanelInstances("side").find(isSession);
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
