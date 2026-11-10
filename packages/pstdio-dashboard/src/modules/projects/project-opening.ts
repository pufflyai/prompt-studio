import { accountEvents } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import {
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";
import { isProjectWorkspaceReady } from "@/shared/workspaces/workspace-state";
import { createProjectPreparation } from "./project-preparation";

/** Cloud owns download progress. Preparing the local folder must not block navigation. */
export const registerProjectOpening = (ctx: WorkbenchModuleContext) => {
  const preparation = createProjectPreparation({
    selected: () => getDashboardSelectedProjectId(ctx),
    ready: isProjectWorkspaceReady,
    status: (id) => getApiClient().account.projectSyncStatus(id),
    open: (id) => getApiClient().projects.open(id),
    failed: ctx.notifications.captureActionError("Open project"),
  });
  const refresh = () => {
    void preparation.refresh();
  };
  const subscriptions = [
    ctx.context.store.subscribeSelector((state) => state.values["dashboard.project.id"], refresh),
    subscribeToExtensionEventFeed((event) => {
      if ([accountEvents.changed.id, accountEvents.projectSyncChanged.id].includes(event.id)) refresh();
    }),
    subscribeToExtensionEventReset(refresh),
  ];
  refresh();
  return {
    dispose() {
      preparation.dispose();
      for (const stop of subscriptions) stop();
    },
  };
};
