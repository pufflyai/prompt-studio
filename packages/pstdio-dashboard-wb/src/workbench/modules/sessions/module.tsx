import type {
  ResourceRef,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import {
  createDashboardSessions,
  type DashboardSession,
  findDashboardSession,
  subscribeDashboardData,
} from "../../data/dashboard-data";
import { getDashboardSelectedProjectId } from "../../shared/project-context";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardResources } from "../../shared/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { syncWorkspaceSidebarSessionSelection } from "../workspaces/workspace-sidebar-tree";
import { SessionBubbleHeader } from "./components/session-bubble-header";
import { SessionViewWidget, SessionWidget } from "./components/session-widget";
import { openFloatingSessionCommandId, openSessionBubbleWidgets } from "./session-bubble";
import { getDashboardSelectedSession, rememberDashboardSession } from "./session-selection";
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

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.sessionBubble,
      title: "Session bubble",
      area: "floating",
      singleton: true,
      rendererId: dashboardWidgetIds.sessionBubble,
      priority: 30,
    },
    { priority: 30 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessionBubble,
    render: (input) => <SessionWidget input={input} />,
  });

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.sessionBubbleHeader,
      title: "Session bubble header",
      area: "floating-header",
      singleton: true,
      rendererId: dashboardWidgetIds.sessionBubbleHeader,
      priority: 30,
    },
    { priority: 30 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessionBubbleHeader,
    render: (input) => <SessionBubbleHeader input={input} />,
  });

  openSessionBubbleWidgets(ctx);
};

const registerSessionCommands = (ctx: WorkbenchModuleContributionContext) => {
  ctx.commands.registerCommand(
    { id: openFloatingSessionCommandId, label: "Open floating session", category: "Dashboard", icon: "MessageCircle" },
    {
      execute: (args) => {
        const { resource } = (args ?? {}) as { resource?: DashboardSession["resource"] };
        const session = findDashboardSession(resource?.id);
        if (!session) return undefined;

        const placement = openSessionBubbleWidgets(ctx, { resource: session.resource, title: session.title });
        if (ctx.modes.getActiveModeId() === "workspace") syncWorkspaceSidebarSessionSelection(ctx, session.resource);
        if (ctx.sessionPanel.getMode() === "closed") ctx.sessionPanel.setMode("bubble");
        return placement.bubble;
      },
    },
  );
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
  if (activeSessionPlacement?.resource?.kind === "session") return;

  openSessionView(ctx, dashboardResources.sessions, { replaceActive: true });
};

// The sessions slice owns the sessions mode, sidebar, and chat view.
export const createSessionsModule = () =>
  ({
    id: "dashboard.sessions",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "session", label: "Session", icon: "MessageCircle" });
      registerSessionWidgets(ctx);
      registerSessionCommands(ctx);
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
