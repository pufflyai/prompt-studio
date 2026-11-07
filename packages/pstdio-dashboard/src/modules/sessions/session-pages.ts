import { sessionBrowser, workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";

/** Deprecated URL definitions use the installed provider's renderer and draft identity. */
import { sessionProviderTab } from "./session-provider-tab";

export const registerSessionPages = (ctx: WorkbenchModuleContext) => {
  const registrations = [
    ctx.pages.registerPage({
      id: workbenchPages.sessions.id,
      ref: workbenchPages.sessions,
      title: "Sessions",
      icon: "message-circle",
      path: "sessions",
      modeId: "project",
      main: { kind: "group", default: workbenchPages.sessionComposer },
      slots: [],
    }),
    ...[
      { ref: workbenchPages.sessionComposer, path: "sessions/compose", title: "New session" },
      { ref: workbenchPages.newSession, path: "sessions/new", title: "New session", kinds: ["session-draft"] },
      { ref: workbenchPages.session, path: "session", title: "Session", kinds: ["session", "session-draft"] },
    ].map(({ ref, path, title, kinds }) =>
      ctx.pages.registerPage({
        id: ref.id,
        ref,
        title,
        icon: "message-circle",
        path,
        modeId: "project",
        parentId: workbenchPages.sessions.id,
        ...(kinds
          ? { resource: { kinds: kinds.map((id) => ({ kind: "resource-kind" as const, id, extensionId: "pstdio" })) } }
          : {}),
        main: {
          kind: "view",
          view: sessionBrowser.views.conversation,
          cardinality: "one",
          presentation: "page",
          tab: sessionProviderTab(ctx),
        },
        ...(kinds ? { panelView: workbenchPanels.projectSession } : {}),
        slots: [],
      }),
    ),
  ];
  return {
    dispose: () => {
      for (const registration of registrations.reverse()) registration.dispose();
    },
  };
};
