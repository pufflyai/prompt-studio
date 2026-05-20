import type { WorkbenchModuleContribution } from "pstdio-workbench/core";
import { dashboardCommandIds, dashboardWidgetIds } from "@/services/workbench/ids";
import {
  dashboardResourceKindIds,
  dashboardViewResource,
  settingsSectionResource,
} from "@/services/workbench/resources/resource-kinds";
import { ProjectHeader } from "./renderers/project-header";
import { StatusBar } from "./renderers/status-bar";

const registerNavigationTree = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.navTree,
    title: "Navigation",
    getBody: () => [
      {
        id: "primary",
        nodes: [
          {
            id: "search",
            label: "Search",
            icon: "Search",
            target: { kind: "command", commandId: "workbench.toggleCommandPalette" },
          },
          { id: "tickets", label: "Tickets", icon: "Ticket", resource: dashboardViewResource("tickets") },
          { id: "workspaces", label: "Workspaces", icon: "GitBranch", resource: dashboardViewResource("workspaces") },
          { id: "sessions", label: "Sessions", icon: "MessagesSquare", resource: dashboardViewResource("sessions") },
        ],
      },
    ],
    getFooter: () => [
      {
        id: "assistant",
        label: "Assistant",
        icon: "PanelRight",
        target: { kind: "command", commandId: dashboardCommandIds.toggleSessionChat },
      },
      {
        id: "settings",
        label: "Project settings",
        icon: "Settings",
        resource: settingsSectionResource("general"),
      },
    ],
    getChildren: () => [],
  });

  ctx.layout.registerWidget({
    id: dashboardWidgetIds.navTree,
    title: "Navigation",
    area: "left",
    singleton: true,
    rendererId: dashboardWidgetIds.navTree,
  });
};

const registerHistoryCommands = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.back, label: "Go back", category: "Navigation", icon: "ArrowLeft" },
    {
      execute: () => {
        ctx.history.goBack();
      },
    },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.forward, label: "Go forward", category: "Navigation", icon: "ArrowRight" },
    {
      execute: () => {
        ctx.history.goForward();
      },
    },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.reopenClosed, label: "Reopen last closed", category: "Navigation", icon: "Undo2" },
    {
      execute: () => {
        ctx.history.reopenLastClosed();
      },
    },
  );
};

// Only dashboard-specific shortcuts are registered here; command palette,
// sidebar, panel, and reopen-closed shortcuts are owned by the workbench core.
const registerKeybindings = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  const bindings: Array<{ keybinding: string; commandId: string }> = [
    { keybinding: "mod+1", commandId: dashboardCommandIds.openTickets },
    { keybinding: "mod+2", commandId: dashboardCommandIds.openWorkspaces },
    { keybinding: "mod+3", commandId: dashboardCommandIds.openSessions },
    { keybinding: "mod+,", commandId: dashboardCommandIds.openSettings },
    { keybinding: "mod+[", commandId: dashboardCommandIds.back },
    { keybinding: "mod+]", commandId: dashboardCommandIds.forward },
  ];
  for (const binding of bindings) ctx.keybindings.registerKeybinding(binding);
};

// Project bootstrap. Registered last so it can open widgets contributed by the
// surface modules. Owns the navigation tree, status bar, project header, the
// global navigation commands/keybindings, and the default opened surface.
export const createProjectModule = (projectId: string): WorkbenchModuleContribution => ({
  id: "pstdio-dashboard-workbench.project",
  activate(ctx) {
    ctx.context.set("project.active", true);
    ctx.resources.registerKind({
      kind: dashboardResourceKindIds.dashboardView,
      label: "Dashboard view",
      icon: "LayoutDashboard",
    });

    registerNavigationTree(ctx);

    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.projectHeader,
      render: () => <ProjectHeader projectId={projectId} />,
    });
    ctx.layout.registerWidget({
      id: dashboardWidgetIds.projectHeader,
      title: "Project",
      area: "left-header",
      singleton: true,
      rendererId: dashboardWidgetIds.projectHeader,
    });

    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.status,
      render: () => <StatusBar projectId={projectId} />,
    });
    ctx.layout.registerWidget({
      id: dashboardWidgetIds.status,
      title: "Status",
      area: "status",
      singleton: true,
      rendererId: dashboardWidgetIds.status,
    });

    registerHistoryCommands(ctx);
    registerKeybindings(ctx);

    ctx.layout.openWidget(dashboardWidgetIds.projectHeader, { pinned: true });
    ctx.layout.openWidget(dashboardWidgetIds.navTree, { pinned: true });
    ctx.layout.openWidget(dashboardWidgetIds.status, { pinned: true });
    ctx.layout.openWidget(dashboardWidgetIds.sessionChat, { pinned: true });

    void ctx.resources.openResource(dashboardViewResource("tickets"));
  },
});
