import {
  type ResourceRef,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  type WorkbenchPanelInstance,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
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
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { setDashboardSidenavSelection, showDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { createDashboardSessions, findDashboardSession } from "./data/dashboard-sessions";
import { createSessionsSidenavSections } from "./sessions-sidenav-tree";

const registerSessionWidgets = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel(
    {
      closable: false,
      id: dashboardWidgetIds.session,
      title: "Session",
      region: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.session,
      floatingPanels: "hidden",
      priority: 40,
    },
    { priority: 40 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.session,
    render: (input) => <SessionViewWidget input={input} />,
  });
};

const setSessionsBreadcrumb = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
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

const openSessionsNavigation = (ctx: WorkbenchModuleContext) => {
  const lastOpenedSession = getDashboardSelectedSession(ctx);
  return ctx.resources.openResource(lastOpenedSession?.resource ?? dashboardResources.sessions, {
    replaceActive: true,
  });
};

const hydrateOpenSessionsView = (ctx: WorkbenchModuleContext) => {
  if (ctx.modes.getActiveModeId() !== "sessions") return;

  const activeSessionPlacement = ctx.layout
    .getLayout()
    .regions.main.widgets.find((placement) => placement.contributionId === dashboardWidgetIds.session);
  const activeKind = activeSessionPlacement?.resource?.kind;
  if (
    activeKind === "session" ||
    activeKind === "session-draft" ||
    activeSessionPlacement?.resourceUri === dashboardResources.sessions.uri
  )
    return;

  void ctx.resources.openResource(dashboardResources.sessions, { replaceActive: true });
};

const createSessionsNavigationNode = () => ({
  id: dashboardResources.sessions.uri,
  label: dashboardResources.sessions.label,
  icon: dashboardResources.sessions.icon,
  canHide: true,
  resource: dashboardResources.sessions,
  target: { kind: "command" as const, commandId: dashboardCommandIds.openSessions },
});

const registerSidenavSessions = (ctx: WorkbenchModuleContext) => {
  registerSidenavContribution(ctx, {
    id: "dashboard.sessions.project-nav",
    modes: ["*"],
    region: "header",
    order: 20,
    getHeaderNodes: () => [createSessionsNavigationNode()],
  });
  // Session and workspace modes share one body contribution; only workspace mode scopes the
  // list to the open workspace (via the primary resource) and opens rows in the Side Panel.
  registerSidenavContribution(ctx, {
    id: "dashboard.sessions.list",
    modes: ["sessions", "workspace"],
    order: 20,
    getSections: () => {
      const isWorkspaceMode = ctx.modes.getActiveModeId() === "workspace";
      return createSessionsSidenavSections({
        projectId: getDashboardSelectedProjectId(ctx),
        workspace: isWorkspaceMode ? ctx.getPrimaryResource() : undefined,
        nodeTarget: isWorkspaceMode ? "side" : "resource",
      });
    },
  });
};

// The sessions slice owns the sessions mode, sidenav, and chat view.
export const createSessionsModule = () =>
  ({
    id: "dashboard.sessions",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "session", label: "Session", icon: "MessageCircle" });
      ctx.resources.registerKind({ kind: "session-draft", label: "Session draft", icon: "PenBox" });
      registerDashboardViewContribution(ctx, { resource: dashboardResources.sessions, group: "Dashboard", order: 20 });
      registerSessionWidgets(ctx);
      registerSidenavSessions(ctx);
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
      const unsubscribeDashboardData = subscribeDashboardData(() => hydrateOpenSessionsView(ctx));

      ctx.modes.registerMode({
        id: "sessions",
        label: "Sessions",
        panels: ["main", "side"],
        activate: () => undefined,
      });

      ctx.resources.registerProvider({
        id: "dashboard-workbench.sessions",
        kind: "session",
        list: () =>
          createDashboardSessions(getDashboardSelectedProjectId(ctx)).map(({ resource }) => ({
            resource,
            group: "Sessions",
            activate: () => ctx.commands.executeCommand(dashboardCommandIds.openSessionPanel, { resource }),
          })),
      });

      registerResourceRoute(ctx, {
        id: "dashboard.sessions.presenter",
        match: (resource) =>
          (resource.kind === "dashboard-view" && resource.id === "sessions") ||
          resource.kind === "session" ||
          resource.kind === "session-draft",
        mode: "sessions",
        panelId: dashboardWidgetIds.session,
        title: (resource) =>
          resource.kind === "session" ? (findDashboardSession(resource.id)?.title ?? resource.label) : resource.label,
        beforeOpen: ({ resource }) => {
          setSessionsBreadcrumb(ctx, resource);
          if (resource.kind === "session") {
            const session = findDashboardSession(resource.id);
            if (session) rememberDashboardSession(ctx, session);
            showDashboardSidenav(ctx, { selectedNode: (session?.resource ?? resource).uri });
          } else {
            forgetDashboardSession(ctx);
            setDashboardSidenavSelection(ctx, undefined);
          }
        },
      });

      // Sessions opened from an extension sidenav (e.g. the planner ticket tree) carry a
      // `sessionSurface: "side"` hint. Honor it by opening the Side Panel session and
      // keeping the host view (the ticket) in place, instead of switching to sessions mode. Higher
      // priority than the default session route so the hint wins; unhinted sessions fall through.
      ctx.resources.registerPresenter({
        id: "dashboard.sessions.side-presenter",
        priority: 1100,
        canOpen: (resource) => resource.kind === "session" && resource.metadata?.sessionSurface === "side",
        open: async (resource) => {
          return (await ctx.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
            resource,
            tabPosition: "start",
            tabRetention: "preview",
          })) as WorkbenchPanelInstance;
        },
      });

      return {
        dispose: unsubscribeDashboardData,
      };
    },
  }) satisfies WorkbenchModuleContribution;
