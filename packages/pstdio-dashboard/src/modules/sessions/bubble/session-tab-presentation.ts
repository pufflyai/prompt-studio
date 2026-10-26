import type { WorkbenchModuleContext, WorkbenchPanelInstance, WorkbenchWidgetTab } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { resolveDashboardWorkspaceIcon } from "@/shared/workspaces/dashboard-workspaces";
import { findDashboardSession, resolveDashboardSessionViewForPlacement } from "../data/dashboard-sessions";
import { subscribeSessionListData } from "../data/session-data-subscription";
import { createSessionIndicator } from "../session-indicator";

const sessionStatus = (instance: WorkbenchPanelInstance, status: string | undefined) => {
  const value = status ?? instance.resource?.metadata?.status;
  return typeof value === "string" ? value : undefined;
};
const workspaceResource = (input: {
  projectId: string | undefined;
  workspaceId: string | null;
  workspaceTitle: string;
  workspaceShorthand: string;
  workspaceBranch: string | null;
}) => {
  if (!input.workspaceId) return undefined;
  return createDashboardResource(
    "workspace",
    input.workspaceId,
    input.workspaceTitle || input.workspaceShorthand || "Workspace",
    resolveDashboardWorkspaceIcon(input.workspaceId),
    input.projectId,
    {
      workspaceId: input.workspaceId,
      ...(input.workspaceBranch ? { workspaceBranch: input.workspaceBranch } : {}),
      ...(input.workspaceShorthand ? { workspaceShorthand: input.workspaceShorthand } : {}),
    },
  );
};
const resolveWorkspace = (ctx: WorkbenchModuleContext, instance: WorkbenchPanelInstance) => {
  const primary = ctx.getPrimaryResource();
  const view = resolveDashboardSessionViewForPlacement(instance);
  if (!view.workspaceId && primary?.type === "workspace") return primary;
  const projectId = ctx.context.get(dashboardSelectedProjectIdContextKey);
  return workspaceResource({
    projectId: typeof projectId === "string" ? projectId : undefined,
    workspaceId: view.workspaceId,
    workspaceTitle: view.workspaceTitle,
    workspaceShorthand: view.workspaceShorthand,
    workspaceBranch: view.workspaceBranch,
  });
};
export const createSessionTabPresentation = (ctx: WorkbenchModuleContext): WorkbenchWidgetTab => ({
  subscribe: subscribeSessionListData,
  getSnapshot(instance) {
    const view = resolveDashboardSessionViewForPlacement(instance);
    const selected = findDashboardSession(view.sessionId);
    const status = sessionStatus(instance, selected?.status);
    const workspace = resolveWorkspace(ctx, instance);
    return {
      label: selected?.title ?? instance.resource?.label ?? "New session",
      icon: "message-circle",
      indicator: createSessionIndicator(status),
      menu: [
        {
          id: "sessions",
          label: "Sessions",
          rows: [
            {
              id: "new-session",
              label: "New session",
              icon: "MessageSquarePlus",
              action: {
                kind: "command",
                commandId: dashboardCommandIds.createSession,
                args: { workspace, replacePanel: instance.placementIdentity, from: instance.resource },
              },
            },
            {
              id: "switch-session",
              label: "Switch session",
              icon: "Search",
              action: {
                kind: "command",
                commandId: dashboardCommandIds.switchSession,
                args: { placementIdentity: instance.placementIdentity, from: instance.resource },
              },
            },
          ],
        },
      ],
    };
  },
});
