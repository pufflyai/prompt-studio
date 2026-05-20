import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardCommandIds, dashboardWidgetIds } from "@/services/workbench/ids";
import { openSurfaceWidget } from "@/services/workbench/module-helpers";
import { dashboardResourceKindIds, dashboardViewResource } from "@/services/workbench/resources/resource-kinds";
import { SessionChat } from "./renderers/session-chat";
import { SessionsOverview } from "./renderers/sessions-overview";

// Sessions surface: an overview list in `main` plus the keep-alive chat renderer
// placed in the `floating` session panel. Opening a session reveals the chat;
// the keep-alive renderer keeps it intact across attached/bubble transitions.
export const createSessionsModule = (projectId: string): WorkbenchModuleContribution => ({
  id: "pstdio-dashboard-workbench.sessions",
  activate(ctx) {
    ctx.resources.registerKind({ kind: dashboardResourceKindIds.session, label: "Session", icon: "MessagesSquare" });

    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.sessionsOverview,
      render: (input) => <SessionsOverview input={input} projectId={projectId} />,
    });
    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.sessionChat,
      keepAlive: true,
      render: () => <SessionChat />,
    });

    ctx.layout.registerWidget({
      id: dashboardWidgetIds.sessionsOverview,
      title: "Sessions",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.sessionsOverview,
    });
    ctx.layout.registerWidget({
      id: dashboardWidgetIds.sessionChat,
      title: "Assistant",
      area: "floating",
      singleton: true,
      closable: true,
      areaSize: { defaultPx: 380, minPx: 320 },
      rendererId: dashboardWidgetIds.sessionChat,
    });

    ctx.resources.registerOpener({
      id: "pstdio-dashboard-workbench.sessions.opener",
      canOpen: (resource) =>
        resource.kind === dashboardResourceKindIds.session ||
        (resource.kind === dashboardResourceKindIds.dashboardView && resource.id === "sessions"),
      open: (resource, input) => {
        if (resource.kind === dashboardResourceKindIds.session) {
          ctx.breadcrumbs.setItems([{ title: resource.label ?? "Session", icon: resource.icon, resource }]);
          ctx.layout.openWidget(dashboardWidgetIds.sessionChat, {
            resource,
            title: resource.label,
            replaceActive: input.replaceActive,
          });
          ctx.sessionPanel.setMode("attached");
          return resource;
        }
        return openSurfaceWidget(ctx, dashboardWidgetIds.sessionsOverview, resource, input);
      },
    });

    ctx.commands.registerCommand(
      { id: dashboardCommandIds.openSessions, label: "Open sessions", category: "Dashboard", icon: "MessagesSquare" },
      { execute: () => ctx.resources.openResource(dashboardViewResource("sessions"), { replaceActive: true }) },
    );
    ctx.commands.registerCommand(
      {
        id: dashboardCommandIds.toggleSessionChat,
        label: "Toggle assistant panel",
        category: "Dashboard",
        icon: "PanelRight",
      },
      {
        execute: () => {
          ctx.sessionPanel.setMode(ctx.sessionPanel.getMode() === "closed" ? "attached" : "closed");
        },
      },
    );
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: dashboardCommandIds.openSessions,
      order: 30,
    });
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: dashboardCommandIds.toggleSessionChat,
      order: 31,
    });
  },
});
