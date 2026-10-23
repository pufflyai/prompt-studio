import { workbenchPages } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createSessionTabPresentation } from "./bubble/session-tab-presentation";

const newSessionPlaceholder = {
  view: { kind: "view", id: dashboardWidgetIds.newSession },
  breadcrumb: {
    label: "New session",
    menu: [
      {
        id: "sessions",
        rows: [
          {
            id: "new-session",
            label: "New session",
            icon: "MessageSquarePlus",
            action: { kind: "command", commandId: dashboardCommandIds.createSession },
          },
          {
            id: "switch-session",
            label: "Switch session",
            icon: "Search",
            action: {
              kind: "command",
              commandId: dashboardCommandIds.switchSession,
              args: { page: workbenchPages.session },
            },
          },
        ],
      },
    ],
  },
} as const;

export const registerSessionPages = (ctx: WorkbenchModuleContext) => {
  ctx.pages.registerPage({
    id: dashboardViews.sessions.id,
    ref: workbenchPages.sessions,
    title: dashboardViews.sessions.label,
    icon: dashboardViews.sessions.icon,
    path: "sessions",
    modeId: "project",
    main: { kind: "panels", empty: newSessionPlaceholder },
    slots: [],
  });
  ctx.pages.registerPage({
    id: workbenchPages.newSession.id,
    ref: workbenchPages.newSession,
    title: "New session",
    icon: "MessageSquarePlus",
    path: "sessions/new",
    modeId: "project",
    parentId: dashboardViews.sessions.id,
    resource: { kinds: [{ kind: "resource-kind", id: "session-draft" }] },
    main: { kind: "panels", empty: newSessionPlaceholder },
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
        { kind: "resource-kind", id: "session" },
        { kind: "resource-kind", id: "session-draft" },
      ],
    },
    main: {
      kind: "view",
      view: { kind: "view", id: dashboardWidgetIds.session },
      cardinality: "one",
      tab: createSessionTabPresentation(ctx),
      empty: newSessionPlaceholder,
    },
    slots: [],
  });
};
