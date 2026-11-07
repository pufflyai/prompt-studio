import { workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createSessionTabPresentation } from "./bubble/session-tab-presentation";

export const registerSessionPages = (ctx: WorkbenchModuleContext) => {
  ctx.pages.registerPage({
    id: dashboardViews.sessions.id,
    ref: workbenchPages.sessions,
    title: dashboardViews.sessions.label,
    icon: dashboardViews.sessions.icon,
    path: "sessions",
    modeId: "project",
    main: { kind: "group", default: workbenchPages.sessionComposer },
    slots: [],
  });
  ctx.pages.registerPage({
    id: workbenchPages.sessionComposer.id,
    ref: workbenchPages.sessionComposer,
    title: "New session",
    icon: "message-circle",
    path: "sessions/compose",
    modeId: "project",
    parentId: dashboardViews.sessions.id,
    main: {
      kind: "view",
      view: { kind: "view", id: dashboardWidgetIds.session },
      cardinality: "one",
      presentation: "page",
      tab: createSessionTabPresentation(ctx),
    },
    slots: [],
  });
  ctx.pages.registerPage({
    id: workbenchPages.newSession.id,
    ref: workbenchPages.newSession,
    title: "New session",
    icon: "message-circle",
    path: "sessions/new",
    modeId: "project",
    parentId: dashboardViews.sessions.id,
    resource: { kinds: [{ kind: "resource-kind", id: "session-draft" }] },
    main: {
      kind: "view",
      view: { kind: "view", id: dashboardWidgetIds.session },
      cardinality: "one",
      presentation: "page",
      tab: createSessionTabPresentation(ctx),
    },
    panelView: workbenchPanels.projectSession,
    slots: [],
  });
  return ctx.pages.registerPage({
    id: workbenchPages.session.id,
    ref: workbenchPages.session,
    title: "Session",
    icon: "message-circle",
    path: "session",
    modeId: "project",
    parentId: dashboardViews.sessions.id,
    resource: {
      kinds: [
        { kind: "resource-kind", id: "session" },
        { kind: "resource-kind", id: "session-draft" },
      ],
    },
    main: {
      kind: "view",
      view: { kind: "view", id: dashboardWidgetIds.session },
      cardinality: "one",
      presentation: "page",
      tab: createSessionTabPresentation(ctx),
    },
    panelView: workbenchPanels.projectSession,
    slots: [],
  });
};
