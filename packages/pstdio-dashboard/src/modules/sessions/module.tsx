import {
  type ResourceRef,
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
} from "pstdio-workbench/core";
import { SessionViewWidget } from "@/modules/sessions/components/session-widget";
import {
  forgetDashboardSession,
  getDashboardSelectedSession,
  rememberDashboardSession,
} from "@/modules/sessions/state/session-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { registerDashboardViewContribution } from "@/shared/workbench/contributions/dashboard-view-contributions";
import {
  registerProjectSidebarContribution,
  registerWorkspaceSidebarContribution,
  sidebarTreeContributionPlacements,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { createDashboardSessions, findDashboardSession } from "./data/dashboard-sessions";
import {
  createSessionsSidebarSections,
  registerSessionsSidebarTree,
  syncSessionsSidebar,
} from "./sessions-sidebar-tree";

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

const setSessionsBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (resource.kind !== "session" && resource.kind !== "session-draft") {
    ctx.breadcrumbs.setItems([
      {
        title: dashboardResources.sessions.label,
        icon: dashboardResources.sessions.icon,
        resource: dashboardResources.sessions,
      },
    ]);
    return;
  }

  const sessionResource =
    resource.kind === "session" ? (findDashboardSession(resource.id)?.resource ?? resource) : resource;

  ctx.breadcrumbs.setItems([
    {
      title: dashboardResources.sessions.label,
      icon: dashboardResources.sessions.icon,
      resource: dashboardResources.sessions,
    },
    {
      title: sessionResource.label ?? "Session",
      icon: sessionResource.icon,
      resource: sessionResource,
    },
  ]);
};

const getOpenSessionResource = (ctx: WorkbenchModuleContributionContext) =>
  Object.values(ctx.layout.getLayout().areas)
    .flatMap((area) => area.widgets)
    .find((placement) => placement.resource?.kind === "session")?.resource;

const resolveSessionsNavigationResource = (ctx: WorkbenchModuleContributionContext) =>
  getOpenSessionResource(ctx) ??
  getDashboardSelectedSession(ctx)?.resource ??
  createDashboardSessions(getDashboardSelectedProjectId(ctx))[0]?.resource ??
  dashboardResources.sessions;

const openSessionsNavigation = (ctx: WorkbenchModuleContributionContext) =>
  ctx.resources.openResource(resolveSessionsNavigationResource(ctx), { replaceActive: true });

const hydrateOpenSessionsView = (ctx: WorkbenchModuleContributionContext) => {
  if (ctx.modes.getActiveModeId() !== "sessions") return;

  const activeSessionPlacement = ctx.layout
    .getLayout()
    .areas.main.widgets.find((placement) => placement.contributionId === dashboardWidgetIds.session);
  const activeKind = activeSessionPlacement?.resource?.kind;
  if (activeKind === "session" || activeKind === "session-draft") return;

  void ctx.resources.openResource(dashboardResources.sessions, { replaceActive: true });
};

const createSessionsNavigationSection = () => ({
  id: "sessions-navigation",
  nodes: [
    {
      id: dashboardResources.sessions.uri,
      label: dashboardResources.sessions.label,
      icon: dashboardResources.sessions.icon,
      resource: dashboardResources.sessions,
      target: { kind: "command" as const, commandId: dashboardCommandIds.openSessions },
    },
  ],
});

const registerSidebarSessions = (ctx: WorkbenchModuleContributionContext) => {
  registerProjectSidebarContribution(ctx, {
    id: "dashboard.sessions.project-sidebar-nav",
    order: 10,
    placement: sidebarTreeContributionPlacements.beforeWorkspaces,
    getSections: () => [createSessionsNavigationSection()],
  });
  registerWorkspaceSidebarContribution(ctx, {
    id: "dashboard.sessions.workspace-sidebar-nav",
    order: 10,
    placement: sidebarTreeContributionPlacements.beforeWorkspaces,
    getSections: (_ctx, input) =>
      createSessionsSidebarSections({
        projectId: getDashboardSelectedProjectId(ctx),
        workspace: input.resource,
        includeNewSession: true,
        nodeTarget: "floating",
      }),
  });
};

// The sessions slice owns the sessions mode, sidebar, and chat view.
export const createSessionsModule = () =>
  ({
    id: "dashboard.sessions",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "session", label: "Session", icon: "MessageCircle" });
      ctx.resources.registerKind({ kind: "session-draft", label: "Session draft", icon: "PenBox" });
      registerDashboardViewContribution(ctx, { resource: dashboardResources.sessions, group: "Dashboard", order: 20 });
      registerSessionWidgets(ctx);
      registerSidebarSessions(ctx);
      if (ctx.commands.getCommand(dashboardCommandIds.createSession)) {
        ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
          commandId: dashboardCommandIds.createSession,
          order: 35,
        });
      }
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openSessions, label: "Open sessions", category: "Dashboard", icon: "MessageCircle" },
        { execute: () => openSessionsNavigation(ctx) },
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
            activate: () => ctx.commands.executeCommand(dashboardCommandIds.openFloatingSession, { resource }),
          })),
      });

      registerResourceRoute(ctx, {
        id: "dashboard.sessions.opener",
        match: (resource) =>
          (resource.kind === "dashboard-view" && resource.id === "sessions") ||
          resource.kind === "session" ||
          resource.kind === "session-draft",
        mode: "sessions",
        widgetId: dashboardWidgetIds.session,
        title: (resource) =>
          resource.kind === "session" ? (findDashboardSession(resource.id)?.title ?? resource.label) : resource.label,
        beforeOpen: ({ resource }) => {
          setSessionsBreadcrumb(ctx, resource);
          if (resource.kind === "session") {
            const session = findDashboardSession(resource.id);
            if (session) rememberDashboardSession(ctx, session);
            syncSessionsSidebar(ctx, session?.resource ?? resource);
          } else {
            forgetDashboardSession(ctx);
            ctx.renderers.setSelectedNode(dashboardWidgetIds.sessionsSidebar, undefined);
          }
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
