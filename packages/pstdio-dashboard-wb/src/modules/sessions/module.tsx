import {
  type ResourceRef,
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
} from "pstdio-workbench/core";
import { SessionViewWidget } from "@/modules/sessions/components/session-widget";
import { getDashboardSelectedSession, rememberDashboardSession } from "@/modules/sessions/state/session-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { registerDashboardViewContribution } from "@/shared/workbench/contributions/dashboard-view-contributions";
import {
  registerProjectSidebarContribution,
  registerWorkspaceSidebarContribution,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { createDashboardSessions, findDashboardSession } from "./data/dashboard-sessions";
import { registerSessionsSidebarTree, syncSessionsSidebar } from "./sessions-sidebar-tree";

const registerSessionWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.session,
      title: "Session",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.session,
      priority: 40,
    },
    { priority: 40 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.session,
    render: (input) => <SessionViewWidget input={input} />,
  });
};

const getLatestSession = (ctx: WorkbenchModuleContributionContext) =>
  createDashboardSessions(getDashboardSelectedProjectId(ctx))[0];

const getInitialSession = (ctx: WorkbenchModuleContributionContext) =>
  getDashboardSelectedSession(ctx) ?? getLatestSession(ctx);

const openSessionView = (
  ctx: WorkbenchModuleContributionContext,
  resource: ResourceRef,
  input: { replaceActive?: boolean },
) => {
  if (resource.kind === "session") {
    const session = findDashboardSession(resource.id);
    const sessionResource = session?.resource ?? resource;

    if (session) rememberDashboardSession(ctx, session);
    syncSessionsSidebar(ctx, sessionResource);
    return ctx.layout.openWidget(dashboardWidgetIds.session, {
      resource: sessionResource,
      title: session?.title ?? resource.label,
      replaceActive: input.replaceActive,
    });
  }

  const session = getInitialSession(ctx);

  if (session) {
    rememberDashboardSession(ctx, session);
    syncSessionsSidebar(ctx, session.resource);
    return ctx.layout.openWidget(dashboardWidgetIds.session, {
      resource: session.resource,
      title: session.title,
      replaceActive: input.replaceActive,
    });
  }

  return ctx.layout.openWidget(dashboardWidgetIds.session, {
    resource: dashboardResources.sessions,
    title: dashboardResources.sessions.label,
    replaceActive: input.replaceActive,
  });
};

const hydrateOpenSessionsView = (ctx: WorkbenchModuleContributionContext) => {
  if (ctx.modes.getActiveModeId() !== "sessions") return;

  const activeSessionPlacement = ctx.layout
    .getLayout()
    .areas.main.widgets.find((placement) => placement.contributionId === dashboardWidgetIds.session);
  const activeKind = activeSessionPlacement?.resource?.kind;
  if (activeKind === "session" || activeKind === "session-draft") return;

  openSessionView(ctx, dashboardResources.sessions, { replaceActive: true });
};

const sessionStatusIcon = (status: string) => {
  if (status === "completed") return "CircleCheck";
  if (status === "failed") return "CircleAlert";
  if (status === "cancelled") return "CircleStop";
  if (status === "disconnected") return "CirclePause";
  if (status === "queued") return "ClockAlert";
  if (status === "awaiting_input") return "CircleDot";
  return "CircleDashed";
};

const sessionStatusColor = (status: string) => {
  if (status === "completed") return "fg.success";
  if (status === "failed") return "fg.error";
  if (status === "cancelled" || status === "disconnected") return "fg.warning";
  if (status === "queued") return "fg.info";
  return "fg.muted";
};

const createSessionsFooterNode = () => ({
  id: dashboardResources.sessions.uri,
  label: "Sessions",
  icon: "MessageCircle",
  resource: dashboardResources.sessions,
});

const registerWorkspaceSidebarSessions = (ctx: WorkbenchModuleContributionContext) => {
  registerProjectSidebarContribution(ctx, {
    id: "dashboard.sessions.project-sidebar",
    order: 30,
    getFooterNodes: () => [createSessionsFooterNode()],
  });
  registerWorkspaceSidebarContribution(ctx, {
    id: "dashboard.sessions.workspace-sidebar",
    order: 30,
    getSections: (sidebarCtx) => {
      if (sidebarCtx.modes.getActiveModeId() !== "workspace") return [];
      const projectId = getDashboardSelectedProjectId(sidebarCtx);
      const selectedNodeId = sidebarCtx.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar).selectedNodeId;
      const workspacePlacement = sidebarCtx.layout
        .getLayout()
        .areas.main.widgets.find((placement) => placement.resource?.kind === "workspace");
      const workspaceId =
        workspacePlacement?.resource?.id ??
        createDashboardSessions(projectId).find(
          (session) => session.resource.uri === selectedNodeId || session.resource.id === selectedNodeId,
        )?.workspaceId;
      if (!workspaceId) return [];
      const sessions = createDashboardSessions(projectId).filter((session) => session.workspaceId === workspaceId);

      return [
        {
          id: "sessions",
          label: "Sessions",
          collapsible: false,
          nodes: sessions.map((session) => ({
            id: session.resource.uri,
            label: session.title,
            icon: sessionStatusIcon(session.status),
            iconColor: sessionStatusColor(session.status),
            target: {
              kind: "command",
              commandId: dashboardCommandIds.openFloatingSession,
              args: { resource: session.resource },
            },
          })),
        },
      ];
    },
    getFooterNodes: () => [createSessionsFooterNode()],
  });
};

// The sessions slice owns the sessions mode, sidebar, and chat view.
export const createSessionsModule = () =>
  ({
    id: "dashboard.sessions",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "session", label: "Session", icon: "MessageCircle" });
      registerDashboardViewContribution(ctx, { resource: dashboardResources.sessions, group: "Dashboard", order: 20 });
      registerSessionWidgets(ctx);
      registerWorkspaceSidebarSessions(ctx);
      if (ctx.commands.getCommand(dashboardCommandIds.createSession)) {
        ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
          commandId: dashboardCommandIds.createSession,
          order: 35,
        });
      }
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openSessions, label: "Open sessions", category: "Dashboard", icon: "MessageCircle" },
        { execute: () => ctx.resources.openResource(dashboardResources.sessions, { replaceActive: true }) },
      );
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openSessions,
        order: 30,
      });
      const sessionsSidebarTree = registerSessionsSidebarTree(ctx);
      const unsubscribeDashboardData = subscribeDashboardData(() => hydrateOpenSessionsView(ctx));

      ctx.modes.registerMode({
        id: "sessions",
        label: "Sessions",
        activate(modeCtx) {
          modeCtx.layout.clearArea("floating");
          modeCtx.layout.clearArea("floating-header");
          modeCtx.layout.clearArea("left");
          modeCtx.layout.openWidget(dashboardWidgetIds.sessionsSidebar, { pinned: true });
          return undefined;
        },
      });

      ctx.resources.registerProvider({
        id: "dashboard-workbench.sessions",
        kind: "session",
        list: () =>
          createDashboardSessions(getDashboardSelectedProjectId(ctx)).map(({ resource }) => ({
            resource,
            group: "Sessions",
          })),
      });

      ctx.resources.registerOpener({
        id: "dashboard.sessions.opener",
        priority: 1000,
        canOpen: (resource) =>
          (resource.kind === "dashboard-view" && resource.id === "sessions") || resource.kind === "session",
        open: (resource, input) => {
          if (!getDashboardSelectedProjectId(ctx)) {
            ctx.modes.setActiveMode("project-selection");
            return undefined;
          }

          ctx.modes.setActiveMode("sessions");
          setResourceBreadcrumb(ctx, resource);
          return openSessionView(ctx, resource, { replaceActive: input.replaceActive });
        },
      });

      return [
        sessionsSidebarTree,
        {
          dispose: unsubscribeDashboardData,
        },
      ];
    },
  }) satisfies WorkbenchModuleContribution;
