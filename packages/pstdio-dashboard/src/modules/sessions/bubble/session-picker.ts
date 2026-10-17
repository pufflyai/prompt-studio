import { type PlacementIdentity, workbenchPages } from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardSessions } from "../data/dashboard-sessions";
import { subscribeSessionListData } from "../data/session-data-subscription";
import { createSessionIndicator } from "../session-indicator";

export const registerSessionPicker = (ctx: WorkbenchModuleContext) => {
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.switchSession, label: "Switch session", category: "Dashboard", icon: "Search" },
    {
      execute: (args) => {
        const { placementIdentity } = (args ?? {}) as { placementIdentity?: PlacementIdentity };
        const projectId = getDashboardSelectedProjectId(ctx);
        const activate = (resource: ResourceRef) => {
          if (placementIdentity?.kind === "page")
            return ctx.navigation.openTarget({ kind: "page", page: workbenchPages.session, resource });
          return ctx.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
            resource,
            replacePanel: placementIdentity,
          });
        };
        ctx.commandPalette.open({
          resourceSearch: {
            label: "Switch session",
            placeholder: "Search sessions",
            subscribe: subscribeSessionListData,
            // Sessions are already synced. Palette virtualizes rows, so long histories render on demand.
            list: () =>
              createDashboardSessions(projectId).map(({ resource, status }) => ({
                resource,
                indicator: createSessionIndicator(status),
                activate,
              })),
          },
        });
      },
    },
  );
};
