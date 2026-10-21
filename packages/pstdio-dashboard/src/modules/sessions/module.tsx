import { resourceKey, workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import {
  type ResourceRef,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
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
import {
  dashboardNavigationSections,
  registerDashboardNavigationContribution,
} from "@/shared/workbench/dashboard-navigation-contribution";
import { setDashboardSidenavSelection, updateDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { createSessionTabPresentation } from "./bubble/session-tab-presentation";
import { createDashboardSessions, findDashboardSession } from "./data/dashboard-sessions";
import { subscribeSessionListData } from "./data/session-data-subscription";
import { createSessionIndicator } from "./session-indicator";
import { registerSessionResourceActions } from "./session-resource-actions";
import { registerSessionResourceSync } from "./session-resource-sync";
import { registerSessionView } from "./session-view";
import { buildSessionsLevelSections, buildWorkspaceSessionsSections } from "./sessions-sidenav-tree";

const removeMatchingSessionPanelPreview = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  for (const placement of Object.values(ctx.layout.getLayout().regions).flatMap((region) => region.widgets)) {
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
    modeId: "project",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: dashboardWidgetIds.session,
      },
      cardinality: "one",
      tab: createSessionTabPresentation(ctx),
    },
    slots: [],
  });
  return ctx.pages.registerPage({
    id: workbenchPages.session.id,
    ref: workbenchPages.session,
    title: "Session",
    icon: dashboardViews.sessions.icon,
    path: "session",
    modeId: "project",
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
      closable: true,
      tab: createSessionTabPresentation(ctx),
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
  if (
    session &&
    (resourceKey(resource) !== resourceKey(session.resource) ||
      resource.label !== session.title ||
      resource.metadata?.status !== session.status)
  ) {
    ctx.pageLocations.replay({
      ...state.location!,
      resource: { ...resource, ...session.resource, metadata: { ...resource.metadata, ...session.resource.metadata } },
    });
    return;
  }
  if (session) rememberDashboardSession(ctx, session);
  const workbenchResource: ResourceRef = session?.resource ?? {
    type: resource.type,
    id: resource.id,
    label: resource.label,
    metadata: resource.metadata,
  };
  removeMatchingSessionPanelPreview(ctx, workbenchResource);
  updateDashboardSidenav(ctx, { selectedNode: resourceKey(workbenchResource) });
};
const registerSidenavSessions = (ctx: WorkbenchModuleContext) => {
  ctx.navigationTrees.registerContribution({
    id: "dashboard.sessions.level",
    owner: { kind: "page", id: dashboardViews.sessions.id, extensionId: "pstdio" },
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getStructure: () => buildSessionsLevelSections(),
    getSections: () => buildSessionsLevelSections(createDashboardSessions(getDashboardSelectedProjectId(ctx))),
  });
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.sessions.project-nav",
    modes: ["project"],
    getSections: () => [{ ...dashboardNavigationSections.root, nodes: [createSessionsNavigationNode()] }],
  });
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.sessions.list",
    modes: ["project"],
    resolveResource: ({ resource }) => (resource?.type === "workspace" ? resource : undefined),
    getSections: (_workbench, input) => {
      const workspace = input.resource?.type === "workspace" ? input.resource : undefined;
      if (!workspace) return [];
      return buildWorkspaceSessionsSections(createDashboardSessions(getDashboardSelectedProjectId(ctx)), workspace);
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
      const active = ctx.layout.getActivePanel();
      const side = state.layout.regions.side;
      const session =
        active?.viewId === dashboardWidgetIds.sessionBubble
          ? active
          : (side.widgets.find((placement) => placement.widgetId === side.activeWidgetId) ?? side.widgets[0]);
      return session?.viewId === dashboardWidgetIds.sessionBubble && session.resource?.type === "session"
        ? session.resource.id
        : undefined;
    },
    (sessionId) => persistence.setSelectedSessionId(sessionId),
  );
};
interface CreateSessionsModuleInput {
  sessionDraftPersistence?: DashboardSessionDraftPersistence;
  sessionSelectionPersistence?: DashboardSessionSelectionPersistence;
}
// The sessions slice owns the Sessions pages, sidenav level, and chat view.
export const createSessionsModule = (input: CreateSessionsModuleInput = {}) =>
  ({
    id: "dashboard.sessions",
    activate(ctx) {
      ctx.resources.registerKind({
        kind: "session",
        label: "Session",
        icon: "MessageCircle",
        resolve: (resource) => findDashboardSession(resource.id)?.resource,
        subscribe: subscribeSessionListData,
      });
      ctx.resources.registerKind({ kind: "session-draft", label: "Session draft", icon: "MessageSquarePlus" });
      registerSessionView(ctx, dashboardWidgetIds.session, input.sessionDraftPersistence);
      registerSessionsPage(ctx);
      registerSidenavSessions(ctx);
      registerSessionResourceActions(ctx);
      const unsubscribeResourceSync = registerSessionResourceSync(ctx, input.sessionSelectionPersistence);
      if (ctx.commands.getCommand(dashboardCommandIds.createSession)) {
        ctx.keybindings.registerKeybinding({
          action: { kind: "command", commandId: dashboardCommandIds.createSession },
          keybinding: "Mod+Alt+S",
        });
      }
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
      ctx.keybindings.registerKeybinding({
        action: { kind: "command", commandId: dashboardCommandIds.openSessions },
        keybinding: "Alt+Shift+S",
      });
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openSessions,
        order: 30,
      });
      const unsubscribeDashboardData = subscribeSessionListData(() => syncSessionsPageSelection(ctx));
      // Persist the Side Panel's actual active session. Main-panel session navigation uses
      // the same in-memory selection context, but must not create a duplicate panel on boot.
      const unsubscribeSelection = registerSidePanelSessionPersistence(ctx, input.sessionSelectionPersistence);
      ctx.resources.registerProvider({
        id: "dashboard-workbench.sessions",
        kind: "session",
        list: () =>
          createDashboardSessions(getDashboardSelectedProjectId(ctx)).map(({ resource, status }) => ({
            resource,
            indicator: createSessionIndicator(status),
            target: { kind: "panel", panel: workbenchPanels.projectSession, resource },
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
          unsubscribeResourceSync();
          unsubscribeSelection();
          unsubscribePage();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
