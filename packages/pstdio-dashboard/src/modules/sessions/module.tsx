import { resourceKey, workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import {
  type ResourceRef,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
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
import { registerDashboardNavigationContribution } from "@/shared/workbench/dashboard-navigation-contribution";
import { setDashboardSidenavSelection, updateDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { createDashboardSessions, findDashboardSession } from "./data/dashboard-sessions";
import { openResourceSessionPreview } from "./session-auto-open";
import { createSessionsSidenavSections } from "./sessions-sidenav-tree";

const registerSessionWidgets = (ctx: WorkbenchModuleContext, drafts?: DashboardSessionDraftPersistence) => {
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.session,
      title: "Session",
      body: { kind: "react", render: (input) => <SessionViewWidget input={input} drafts={drafts} /> },
    },
    { priority: 40 },
  );
};
const removeMatchingSidePanelPreview = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  for (const placement of ctx.layout.getLayout().regions.side.widgets) {
    if (
      placement.viewId === dashboardWidgetIds.sessionBubble &&
      placement.resourceKey === resourceKey(resource) &&
      placement.tabRetention === "preview"
    ) {
      if (placement.placementIdentity) ctx.modePlacements.closePlacement(placement.placementIdentity);
    }
  }
};
const openSessionsNavigation = (ctx: WorkbenchModuleContext) => {
  const lastOpenedSession = getDashboardSelectedSession(ctx);
  return openSessionsPage(ctx, lastOpenedSession?.resource);
};
const createSessionsNavigationNode = () => ({
  id: dashboardViews.sessions.id,
  label: dashboardViews.sessions.label,
  icon: dashboardViews.sessions.icon,
  canHide: true,
  target: { kind: "page" as const, page: workbenchPages.sessions },
});
const registerSessionsPage = (ctx: WorkbenchModuleContext) => {
  ctx.pages.registerPage({
    id: dashboardViews.sessions.id,
    ref: workbenchPages.sessions,
    title: dashboardViews.sessions.label,
    icon: dashboardViews.sessions.icon,
    path: "sessions",
    modeId: "sessions",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: dashboardWidgetIds.session,
      },
      cardinality: "one",
    },
    slots: [],
  });
  return ctx.pages.registerPage({
    id: workbenchPages.session.id,
    ref: workbenchPages.session,
    title: "Session",
    icon: dashboardViews.sessions.icon,
    path: "session",
    modeId: "sessions",
    parentId: dashboardViews.sessions.id,
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: "session",
        },
        {
          kind: "resource-kind",
          id: "session-draft",
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: dashboardWidgetIds.session,
      },
      cardinality: "one",
    },
    slots: [],
  });
};
const syncSessionsPageSelection = (ctx: WorkbenchModuleContext) => {
  const state = ctx.pages.store.getState();
  if (state.activePageId !== dashboardViews.sessions.id && state.activePageId !== workbenchPages.session.id) return;
  const resource = state.location?.resource;
  if (resource?.type !== "session") {
    forgetDashboardSession(ctx);
    setDashboardSidenavSelection(ctx, undefined);
    return;
  }
  const session = findDashboardSession(resource.id);
  if (session) rememberDashboardSession(ctx, session);
  const workbenchResource: ResourceRef = session?.resource ?? {
    type: resource.type,
    id: resource.id,
    label: resource.label,
    metadata: resource.metadata,
  };
  removeMatchingSidePanelPreview(ctx, workbenchResource);
  updateDashboardSidenav(ctx, { selectedNode: resourceKey(workbenchResource) });
};
const registerSidenavSessions = (ctx: WorkbenchModuleContext) => {
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.sessions.project-nav",
    modes: ["project"],
    getSections: () => [{ id: "navigation.root", nodes: [createSessionsNavigationNode()] }],
  });
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.sessions.list",
    modes: ["sessions", "project"],
    getSections: (_workbench, input) => {
      const workspace = input.modeId === "project" && input.resource?.type === "workspace" ? input.resource : undefined;
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
      return active?.viewId === dashboardWidgetIds.sessionBubble && active.resource?.type === "session"
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
      registerSessionsPage(ctx);
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
      const unsubscribeDashboardData = subscribeDashboardData(() => syncSessionsPageSelection(ctx));
      // Workspaces and extension-owned resources can carry a conversation; opening one brings it along.
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
            activate: () =>
              ctx.navigation.openTarget({
                kind: "panel",
                panel: workbenchPanels.projectSession,
                resource: resource,
                open: "preview",
              }),
          })),
      });
      const unsubscribePage = ctx.pages.store.subscribe(() => syncSessionsPageSelection(ctx));
      return {
        dispose: () => {
          unsubscribeDashboardData();
          unsubscribeSelection();
          unsubscribePage();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
