import {
  type ResourceRef,
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench/core";
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
import { registerSidebarContribution } from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { setDashboardSidebarSelection, showDashboardSidebar } from "@/shared/workbench/dashboard-sidebar";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { createDashboardSessions, findDashboardSession } from "./data/dashboard-sessions";
import { createSessionsSidebarSections } from "./sessions-sidebar-tree";

const registerSessionWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerLocation(
    {
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
  Object.values(ctx.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
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
    .regions.main.widgets.find((placement) => placement.contributionId === dashboardWidgetIds.session);
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
      canHide: true,
      resource: dashboardResources.sessions,
      target: { kind: "command" as const, commandId: dashboardCommandIds.openSessions },
    },
  ],
});

// New-session is a header row in session and workspace modes (workspace-scoped in workspace mode),
// composed like the body/footer contributions and rendered in the persistent header.
const newSessionHeaderNode = (ctx: WorkbenchModuleContributionContext) => {
  const workspace = ctx.modes.getActiveModeId() === "workspace" ? ctx.getPrimaryResource() : undefined;

  return {
    id: "new-session",
    label: "New session",
    icon: "PenBox",
    canHide: true,
    target: {
      kind: "command" as const,
      commandId: dashboardCommandIds.createSession,
      ...(workspace ? { args: { workspace } } : {}),
    },
  };
};

const registerSidebarSessions = (ctx: WorkbenchModuleContributionContext) => {
  registerSidebarContribution(ctx, {
    id: "dashboard.sessions.project-nav",
    modes: ["project"],
    order: 10,
    getSections: () => [createSessionsNavigationSection()],
  });
  registerSidebarContribution(ctx, {
    id: "dashboard.sessions.new-session",
    modes: ["sessions", "workspace"],
    region: "header",
    order: 10,
    getHeaderNodes: () => [newSessionHeaderNode(ctx)],
  });
  // Session and workspace modes share one body contribution; only workspace mode scopes the
  // list to the open workspace (via the primary resource) and opens rows in the Side Panel.
  registerSidebarContribution(ctx, {
    id: "dashboard.sessions.list",
    modes: ["sessions", "workspace"],
    order: 20,
    getSections: () => {
      const isWorkspaceMode = ctx.modes.getActiveModeId() === "workspace";
      return createSessionsSidebarSections({
        projectId: getDashboardSelectedProjectId(ctx),
        workspace: isWorkspaceMode ? ctx.getPrimaryResource() : undefined,
        nodeTarget: isWorkspaceMode ? "side" : "resource",
      });
    },
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
      const unsubscribeDashboardData = subscribeDashboardData(() => hydrateOpenSessionsView(ctx));

      ctx.modes.registerMode({
        id: "sessions",
        label: "Sessions",
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
            showDashboardSidebar(ctx, { selectedNode: (session?.resource ?? resource).uri });
          } else {
            forgetDashboardSession(ctx);
            setDashboardSidebarSelection(ctx, undefined);
          }
        },
      });

      // Sessions opened from an extension sidebar (e.g. the planner ticket tree) carry a
      // `sessionSurface: "side"` hint. Honor it by opening the Side Panel session and
      // keeping the host view (the ticket) in place, instead of switching to sessions mode. Higher
      // priority than the default session route so the hint wins; unhinted sessions fall through.
      ctx.resources.registerOpener({
        id: "dashboard.sessions.side-opener",
        priority: 1100,
        canOpen: (resource) => resource.kind === "session" && resource.metadata?.sessionSurface === "side",
        open: (resource) => {
          void ctx.commands.executeCommand(dashboardCommandIds.openSessionPanel, { resource });
          return undefined;
        },
      });

      return {
        dispose: unsubscribeDashboardData,
      };
    },
  }) satisfies WorkbenchModuleContribution;
