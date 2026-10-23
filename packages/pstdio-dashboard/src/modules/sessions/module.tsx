import { Spinner } from "@chakra-ui/react";
import { resourceKey, workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import {
  type ResourceRef,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
import { lazy, Suspense } from "react";
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
import { createDashboardSessions, findDashboardSession } from "./data/dashboard-sessions";
import { subscribeSessionListData } from "./data/session-data-subscription";
import { createSessionIndicator } from "./session-indicator";
import { registerSessionPages } from "./session-pages";
import { registerSessionResourceActions } from "./session-resource-actions";
import { registerSessionResourceRetention } from "./session-resource-retention";
import { registerSessionResourceSync } from "./session-resource-sync";
import { buildSessionsLevelSections, buildWorkspaceSessionsSections } from "./sessions-sidenav-tree";

const SessionWidget = lazy(() =>
  import("@/modules/sessions/components/session-widget").then((module) => ({ default: module.SessionWidget })),
);
const NewSessionPage = lazy(() =>
  import("./components/new-session-page").then((module) => ({ default: module.NewSessionPage })),
);

const registerSessionWidgets = (ctx: WorkbenchModuleContext, drafts?: DashboardSessionDraftPersistence) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.newSession,
    title: "New session",
    body: {
      kind: "react",
      render: (input) => (
        <Suspense fallback={<Spinner />}>
          <NewSessionPage workbench={input.workbench} drafts={drafts} />
        </Suspense>
      ),
    },
  });
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.session,
      title: "Session",
      body: {
        kind: "react",
        render: (input) => (
          <Suspense fallback={<Spinner />}>
            <SessionWidget input={input} drafts={drafts} />
          </Suspense>
        ),
      },
    },
    { priority: 40 },
  );
};
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
const syncSessionsPageSelection = (ctx: WorkbenchModuleContext) => {
  const state = ctx.pages.store.getState();
  if (
    ![workbenchPages.sessions.id, workbenchPages.session.id, workbenchPages.newSession.id].some(
      (id) => id === state.activePageId,
    )
  )
    return;
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
      registerSessionWidgets(ctx, input.sessionDraftPersistence);
      registerSessionPages(ctx);
      registerSidenavSessions(ctx);
      registerSessionResourceActions(ctx);
      const unsubscribeResourceSync = registerSessionResourceSync(ctx, input.sessionSelectionPersistence);
      const unsubscribeRetention = registerSessionResourceRetention(ctx);
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
          unsubscribeRetention();
          unsubscribeSelection();
          unsubscribePage();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
