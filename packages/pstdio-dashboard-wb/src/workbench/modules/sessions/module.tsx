import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerSessionDataRenderer } from "./collections/session-data-renderer";
import { SessionBubbleHeader } from "./components/session-bubble-header";
import { SessionWidget } from "./components/session-widget";
import { dashboardSessions } from "./mock-data/sessions";
import { openFloatingSessionCommandId, openSessionBubbleWidgets } from "./session-bubble";
import { registerSessionsSidebarTree, syncSessionsSidebar } from "./sessions-sidebar-tree";

const registerSessionWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.session,
      title: "Session",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.session,
      priority: 40,
    },
    { priority: 40 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.session,
    render: (input) => <SessionWidget input={input} />,
  });

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.sessionBubble,
      title: "Session bubble",
      area: "floating",
      singleton: true,
      rendererId: dashboardWidgetIds.sessionBubble,
      priority: 30,
    },
    { priority: 30 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessionBubble,
    render: (input) => <SessionWidget input={input} />,
  });

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.sessionBubbleHeader,
      title: "Session bubble header",
      area: "floating-header",
      singleton: true,
      rendererId: dashboardWidgetIds.sessionBubbleHeader,
      priority: 30,
    },
    { priority: 30 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessionBubbleHeader,
    render: (input) => <SessionBubbleHeader input={input} />,
  });

  openSessionBubbleWidgets(ctx);
};

const resolveSession = (resourceId: string | undefined) =>
  dashboardSessions.find((session) => session.id === resourceId) ?? dashboardSessions[0];

const registerSessionCommands = (ctx: WorkbenchModuleContributionContext) => {
  ctx.commands.registerCommand(
    { id: openFloatingSessionCommandId, label: "Open floating session", category: "Dashboard", icon: "MessageCircle" },
    {
      execute: (args) => {
        const { resource } = (args ?? {}) as { resource?: (typeof dashboardSessions)[number]["resource"] };
        const session = resolveSession(resource?.id);
        const placement = openSessionBubbleWidgets(ctx, { resource: session.resource, title: session.title });
        if (ctx.sessionPanel.getMode() === "closed") ctx.sessionPanel.setMode("bubble");
        return placement.bubble;
      },
    },
  );
};

// The sessions slice owns the sessions mode, sidebar, overview, and chat view.
export const createSessionsModule = () =>
  ({
    id: "dashboard.sessions",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "session", label: "Session", icon: "MessageCircle" });
      registerSessionDataRenderer(ctx);
      registerSessionWidgets(ctx);
      registerSessionCommands(ctx);
      registerSessionsSidebarTree(ctx);

      ctx.modes.registerMode({
        id: "sessions",
        label: "Sessions",
        activate(modeCtx) {
          modeCtx.layout.clearArea("floating");
          modeCtx.layout.clearArea("floating-header");
          modeCtx.layout.clearArea("left");
          modeCtx.layout.openWidget(dashboardWidgetIds.sessionsSidebar, { pinned: true });
          return undefined;
        },
      });

      ctx.resources.registerProvider({
        id: "dashboard-workbench.sessions",
        kind: "session",
        list: () => dashboardSessions.map(({ resource }) => ({ resource, group: "Sessions" })),
      });

      ctx.resources.registerOpener({
        id: "dashboard.sessions.opener",
        priority: 1000,
        canOpen: (resource) =>
          (resource.kind === "dashboard-view" && resource.id === "sessions") || resource.kind === "session",
        open: (resource, input) => {
          ctx.modes.setActiveMode("sessions");
          setResourceBreadcrumb(ctx, resource);
          if (resource.kind === "session") {
            const session = resolveSession(resource.id);
            syncSessionsSidebar(ctx, session.resource);
            return ctx.layout.openWidget(dashboardWidgetIds.session, {
              resource: session.resource,
              title: session.title,
              replaceActive: input.replaceActive,
            });
          }

          return ctx.layout.openWidget(dashboardWidgetIds.sessions, {
            resource,
            title: resource.label,
            replaceActive: input.replaceActive,
          });
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
