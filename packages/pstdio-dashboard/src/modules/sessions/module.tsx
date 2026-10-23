import { Spinner } from "@chakra-ui/react";
import { resourceKey, workbenchPages } from "@pstdio/sdk/extensions";
import {
  type ResourceRef,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
import { lazy, Suspense } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  dashboardNavigationSections,
  registerDashboardNavigationContribution,
} from "@/shared/workbench/dashboard-navigation-contribution";
import { setDashboardSidenavSelection, updateDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { createSessionBubbleModule } from "./bubble/module";
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

const registerSessionView = (ctx: WorkbenchModuleContext, drafts?: DashboardSessionDraftPersistence) => {
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.session,
      title: "Session",
      icon: "message-circle",
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
const openSessionsNavigation = (ctx: WorkbenchModuleContext) => openSessionsPage(ctx);
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
    ![
      workbenchPages.sessions.id,
      workbenchPages.sessionComposer.id,
      workbenchPages.session.id,
      workbenchPages.newSession.id,
    ].some((id) => id === state.activePageId)
  )
    return;
  const resource = state.location?.resource;
  if (resource?.type !== "session") {
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
  const workbenchResource: ResourceRef = session?.resource ?? {
    type: resource.type,
    id: resource.id,
    label: resource.label,
    metadata: resource.metadata,
  };
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
interface CreateSessionsModuleInput {
  sessionDraftPersistence?: DashboardSessionDraftPersistence;
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
      ctx.resources.registerKind({ kind: "session-draft", label: "Session draft", icon: "message-circle" });
      ctx.registerChildModule(createSessionBubbleModule({ sessionDraftPersistence: input.sessionDraftPersistence }));
      registerSessionView(ctx, input.sessionDraftPersistence);
      registerSessionPages(ctx);
      registerSidenavSessions(ctx);
      registerSessionResourceActions(ctx);
      const unsubscribeResourceSync = registerSessionResourceSync(ctx);
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
      ctx.keybindings.registerKeybinding({
        action: { kind: "page", page: workbenchPages.sessions },
        keybinding: "S",
        layer: "go",
        sticky: true,
      });
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openSessions,
        order: 30,
      });
      const unsubscribeDashboardData = subscribeSessionListData(() => syncSessionsPageSelection(ctx));
      ctx.resources.registerProvider({
        id: "dashboard-workbench.sessions",
        kind: "session",
        list: () =>
          createDashboardSessions(getDashboardSelectedProjectId(ctx)).map(({ resource, status }) => ({
            resource,
            indicator: createSessionIndicator(status),
            target: { kind: "page", page: workbenchPages.session, resource },
            group: "Sessions",
            activate: () => openSessionsPage(ctx, resource),
          })),
      });
      const unsubscribePage = ctx.pages.store.subscribe(() => syncSessionsPageSelection(ctx));
      return {
        dispose: () => {
          unsubscribeDashboardData();
          unsubscribeResourceSync();
          unsubscribeRetention();
          unsubscribePage();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
