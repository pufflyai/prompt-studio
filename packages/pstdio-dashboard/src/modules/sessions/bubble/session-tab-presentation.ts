import { workbenchPages } from "@pstdio/sdk/extensions";
import { resolveSessionIndicatorColor, type SessionCompletionStatus } from "@pstdio/ui";
import type {
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchPanelInstance,
  WorkbenchWidgetTab,
} from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { resolveDashboardWorkspaceIcon } from "@/shared/workspaces/dashboard-workspaces";
import {
  createDashboardSessions,
  findDashboardSession,
  resolveDashboardSessionViewForPlacement,
} from "../data/dashboard-sessions";
import { subscribeSessionListData } from "../data/session-data-subscription";
import { sessionMenuPage } from "./session-menu-page";

const sessionStatusIcon = (status: SessionCompletionStatus | undefined) => {
  if (status === "in_progress") return "LoaderCircle";
  if (status === "completed") return "CircleCheck";
  if (status === "failed") return "CircleAlert";
  if (status === "cancelled") return "CircleStop";
  if (status === "disconnected") return "CirclePause";
  if (status === "queued") return "ClockAlert";
  if (status === "awaiting_input") return "CircleDot";
  return "CircleDashed";
};
const sessionOpenAction = (instance: WorkbenchPanelInstance, resource: ResourceRef) => {
  if (instance.placementIdentity?.kind === "page")
    return { kind: "navigation" as const, target: { kind: "page" as const, page: workbenchPages.session, resource } };
  return {
    kind: "command" as const,
    commandId: dashboardCommandIds.openSessionPanel,
    args: { resource, replacePanel: instance.placementIdentity },
  };
};
const sessionStatus = (instance: WorkbenchPanelInstance, status: string | undefined) => {
  const value = status ?? instance.resource?.metadata?.status;
  return typeof value === "string" ? (value as SessionCompletionStatus) : undefined;
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
    const projectIdValue = ctx.context.get(dashboardSelectedProjectIdContextKey);
    const projectId = typeof projectIdValue === "string" ? projectIdValue : undefined;
    const view = resolveDashboardSessionViewForPlacement(instance);
    const selected = findDashboardSession(view.sessionId);
    const status = sessionStatus(instance, selected?.status);
    const workspace = resolveWorkspace(ctx, instance);
    return {
      label: selected?.title ?? instance.resource?.label ?? "New session",
      indicator: {
        icon: sessionStatusIcon(status),
        color: resolveSessionIndicatorColor(status),
        label: status ? `Session status: ${status}` : "Session status",
      },
      menu: [
        {
          id: "quick-access",
          label: "Quick access",
          rows: [
            {
              id: "new-session",
              label: "New session",
              icon: "MessageSquarePlus",
              action: {
                kind: "command",
                commandId: dashboardCommandIds.createSession,
                args: { workspace, replacePanel: instance.placementIdentity },
              },
            },
          ],
          list: {
            searchLabel: "Search sessions",
            emptyLabel: "No sessions yet",
            loadPage: async (request) => {
              const sessions = createDashboardSessions(projectId);
              const page = sessionMenuPage(sessions, request);
              return {
                nextCursor: page.nextCursor,
                rows: page.rows.map((session) => ({
                  id: session.id,
                  label: session.title,
                  icon: sessionStatusIcon(session.status as SessionCompletionStatus),
                  iconColor: resolveSessionIndicatorColor(session.status as SessionCompletionStatus),
                  selected: session.id === view.sessionId,
                  action: sessionOpenAction(instance, session.resource),
                })),
              };
            },
          },
          trailingRows: [
            {
              id: "view-all-sessions",
              label: "View all sessions",
              icon: "ArrowUpRight",
              action: { kind: "command", commandId: dashboardCommandIds.openSessions },
            },
          ],
        },
      ],
    };
  },
});
