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
import { dashboardViews } from "@/shared/app/resources";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import type { DashboardSessionSelectionPersistence } from "@/shared/app/session-selection-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { setDashboardSidenavSelection, showDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
import { registerDashboardViewRoute, registerResourceRoute } from "@/shared/workbench/route-helper";
import { createDashboardSessions, findDashboardSession } from "./data/dashboard-sessions";
import { openResourceSessionPreview } from "./session-auto-open";
import { createSessionsSidenavSections } from "./sessions-sidenav-tree";

const registerSessionWidgets = (ctx: WorkbenchModuleContext, drafts?: DashboardSessionDraftPersistence) => {
  ctx.layout.registerPanel(
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
    render: (input) => <SessionViewWidget input={input} drafts={drafts} />,
  });
};

const setSessionsBreadcrumb = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const root = {
    title: dashboardViews.sessions.label,
    icon: dashboardViews.sessions.icon,
    onClick: () => void ctx.views.openView(dashboardViews.sessions.id, { strategy: { kind: "replace-active" } }),
  };
  if (resource.kind !== "session" && resource.kind !== "session-draft") {
    ctx.breadcrumbs.setItems([{ title: root.title, icon: root.icon }]);
    return;
  }

  const sessionResource =
    resource.kind === "session" ? (findDashboardSession(resource.id)?.resource ?? resource) : resource;

  ctx.breadcrumbs.setItems([
    root,
    {
      title: sessionResource.label ?? "Session",
      icon: sessionResource.icon,
      resource: sessionResource,
    },
  ]);
};

const removeMatchingSidePanelPreview = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  for (const placement of ctx.layout.listPanelInstances("side")) {
    if (
      placement.panelId === dashboardWidgetIds.sessionBubble &&
      placement.resourceUri === resource.uri &&
      placement.tabRetention === "preview"
    ) {
      ctx.layout.removeWidgetPlacement(placement.instanceId);
    }
  }
};

const openSessionsNavigation = (ctx: WorkbenchModuleContext) => {
  const lastOpenedSession = getDashboardSelectedSession(ctx);
  if (lastOpenedSession) return ctx.resources.openResource(lastOpenedSession.resource, { replaceActive: true });
  return ctx.views.openView(dashboardViews.sessions.id, { strategy: { kind: "replace-active" } });
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
    activeSessionPlacement?.viewId === dashboardViews.sessions.id
  )
    return;

  void ctx.views.openView(dashboardViews.sessions.id, { strategy: { kind: "replace-active" } });
};

const createSessionsNavigationNode = () => ({
  id: dashboardViews.sessions.id,
  label: dashboardViews.sessions.label,
  icon: dashboardViews.sessions.icon,
  canHide: true,
  target: { kind: "view" as const, viewId: dashboardViews.sessions.id },
});

const registerSidenavSessions = (ctx: WorkbenchModuleContext) => {
  registerSidenavContribution(ctx, {
    id: "dashboard.sessions.project-nav",
    modes: ["*"],
    region: "header",
    order: 20,
    getHeaderNodes: () => [createSessionsNavigationNode()],
  });
  registerSidenavContribution(ctx, {
    id: "dashboard.sessions.list",
    modes: ["sessions", "project"],
    order: 20,
    getSections: (_workbench, input) => {
      const workspace = input.modeId === "project" && input.resource?.kind === "workspace" ? input.resource : undefined;
      if (input.modeId === "project" && !workspace) return [];

      return createSessionsSidenavSections({
        projectId: getDashboardSelectedProjectId(ctx),
        workspace,
        nodeTarget: workspace ? "side" : "resource",
      });
    },
  });
};

const registerSidePanelSessionPersistence = (
  ctx: WorkbenchModuleContext,
  persistence: DashboardSessionSelectionPersistence | undefined,
) => {
  if (!persistence) return () => undefined;

  return ctx.layout.store.subscribeSelector(
    (state) => {
      const side = state.layout.regions.side;
      const active = side.widgets.find((placement) => placement.widgetId === side.activeWidgetId) ?? side.widgets[0];
      return active?.contributionId === dashboardWidgetIds.sessionBubble && active.resource?.kind === "session"
        ? active.resource.id
        : undefined;
    },
    (sessionId) => persistence.setSelectedSessionId(sessionId),
  );
};

interface CreateSessionsModuleInput {
  sessionDraftPersistence?: DashboardSessionDraftPersistence;
  sessionSelectionPersistence?: DashboardSessionSelectionPersistence;
}

// The sessions slice owns the sessions mode, sidenav, and chat view.
export const createSessionsModule = (input: CreateSessionsModuleInput = {}) =>
  ({
    id: "dashboard.sessions",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "session", label: "Session", icon: "MessageCircle" });
      ctx.resources.registerKind({ kind: "session-draft", label: "Session draft", icon: "PenBox" });
      registerSessionWidgets(ctx, input.sessionDraftPersistence);
      registerDashboardViewRoute(ctx, {
        id: dashboardViews.sessions.id,
        mode: "sessions",
        panelId: dashboardWidgetIds.session,
        path: "sessions",
        title: dashboardViews.sessions.label,
        icon: dashboardViews.sessions.icon,
        beforeOpen: () => {
          setSessionsBreadcrumb(ctx, { kind: "view", uri: "", id: dashboardViews.sessions.id });
          forgetDashboardSession(ctx);
          setDashboardSidenavSelection(ctx, undefined);
        },
      });
      registerSidenavSessions(ctx);
      if (ctx.commands.getCommand(dashboardCommandIds.createSession)) {
        ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
          commandId: dashboardCommandIds.createSession,
          order: 35,
        });
      }
      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.openSessions,
          label: "Open sessions",
          category: "Dashboard",
          icon: dashboardViews.sessions.icon,
        },
        { execute: () => openSessionsNavigation(ctx) },
      );
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openSessions,
        order: 30,
      });
      const unsubscribeDashboardData = subscribeDashboardData(() => hydrateOpenSessionsView(ctx));
      // Workspaces and tickets both carry a conversation; opening one brings it along.
      ctx.onDidChangePrimaryResource((resource) => {
        if (resource) openResourceSessionPreview(ctx, resource);
      });
      // Persist the Side Panel's actual active session. Main-panel session navigation uses
      // the same in-memory selection context, but must not create a duplicate panel on boot.
      const unsubscribeSelection = registerSidePanelSessionPersistence(ctx, input.sessionSelectionPersistence);

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
        match: (resource) => resource.kind === "session" || resource.kind === "session-draft",
        mode: "sessions",
        panelId: dashboardWidgetIds.session,
        title: (resource) =>
          resource.kind === "session" ? (findDashboardSession(resource.id)?.title ?? resource.label) : resource.label,
        beforeOpen: ({ resource }) => {
          setSessionsBreadcrumb(ctx, resource);
          if (resource.kind === "session") {
            removeMatchingSidePanelPreview(ctx, resource);
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
          })) as WorkbenchPanelInstance;
        },
      });

      return {
        dispose: () => {
          unsubscribeDashboardData();
          unsubscribeSelection();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
