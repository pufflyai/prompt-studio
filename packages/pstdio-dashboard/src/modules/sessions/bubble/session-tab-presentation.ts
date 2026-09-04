import { resolveSessionIndicatorColor, type SessionCompletionStatus } from "@pstdio/ui";
import type { WorkbenchModuleContext, WorkbenchPanelInstance, WorkbenchWidgetTab } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { createDashboardSessions, resolveDashboardSessionViewForPlacement } from "../data/dashboard-sessions";

const maxSessionsInMenu = 5;

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
    "GitBranch",
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
  if (primary?.kind === "workspace") return primary;
  const view = resolveDashboardSessionViewForPlacement(instance);
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
  subscribe: subscribeDashboardData,
  getSnapshot(instance) {
    const projectIdValue = ctx.context.get(dashboardSelectedProjectIdContextKey);
    const projectId = typeof projectIdValue === "string" ? projectIdValue : undefined;
    const view = resolveDashboardSessionViewForPlacement(instance);
    const sessions = createDashboardSessions(projectId);
    const selected = sessions.find((session) => session.id === view.sessionId);
    const status = sessionStatus(instance, selected?.status);
    const workspace = resolveWorkspace(ctx, instance);
    const recentRows = sessions.slice(0, maxSessionsInMenu).map((session) => ({
      id: session.id,
      label: session.title,
      icon: sessionStatusIcon(session.status as SessionCompletionStatus),
      iconColor: resolveSessionIndicatorColor(session.status as SessionCompletionStatus),
      selected: session.id === view.sessionId,
      action: {
        kind: "command" as const,
        commandId: dashboardCommandIds.openSessionPanel,
        args: {
          resource: session.resource,
          pinPreviewSessions: instance.resource?.kind === "session-draft",
        },
      },
    }));

    return {
      label: selected?.title ?? instance.resource?.label ?? "New session",
      indicator: {
        icon: sessionStatusIcon(status),
        color: resolveSessionIndicatorColor(status),
        label: status ? `Session status: ${status}` : "Session status",
      },
      menu: [
        {
          id: "create",
          rows: [
            {
              id: "new-session",
              label: "New session",
              icon: "PenBox",
              action: {
                kind: "command",
                commandId: dashboardCommandIds.createSession,
                args: workspace ? { workspace } : undefined,
              },
            },
          ],
        },
        {
          id: "recent",
          rows:
            recentRows.length > 0
              ? recentRows
              : [{ id: "empty", label: "No sessions yet", icon: "MessageCircle", disabled: true }],
        },
        {
          id: "all",
          rows: [
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
