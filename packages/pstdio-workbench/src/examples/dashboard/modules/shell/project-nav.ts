import type { WorkbenchModeActivationContext } from "../../../../core";
import { dashboardResources, dashboardViews } from "../../shared/mock-data/resources";
import { dashboardHelpMenuPath } from "./commands";

export const dashboardNavigationTreeViewId = "dashboard-workbench.navigation";

// Builds the project navigation tree shown in the Sidenav while the
// "project" mode is active. Navigation only targets pages, commands, and
// hrefs, so each row routes through the dashboard command that opens the
// destination view (the command keeps the mode + breadcrumb side effects).
export const registerProjectNavigation = (ctx: WorkbenchModeActivationContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardNavigationTreeViewId,
    title: "Acme",
    defaultExpandedSectionIds: ["extensions"],
    getBody: async () => [
      {
        id: "primary",
        nodes: [
          {
            id: "search",
            label: "Search",
            icon: "Search",
            target: { kind: "command", commandId: "dashboard.openCommandPalette" },
          },
          {
            id: dashboardViews.tickets.id,
            label: "Tickets",
            icon: dashboardViews.tickets.icon,
            target: { kind: "command", commandId: "dashboard.openTickets" },
          },
          {
            id: dashboardViews.workspaces.id,
            label: "Workspaces",
            icon: dashboardViews.workspaces.icon,
            target: { kind: "command", commandId: "dashboard.openWorkspaces" },
          },
        ],
      },
      {
        id: "extensions",
        label: "Extensions",
        collapsible: false,
        nodes: [
          {
            id: dashboardViews.lab.id,
            label: "Lab",
            icon: "FlaskConical",
            target: { kind: "command", commandId: "dashboard.openLab" },
          },
          {
            id: dashboardViews.repoHealth.id,
            label: "Repo health",
            icon: "GitBranch",
            target: { kind: "command", commandId: "dashboard.openRepoHealth" },
          },
          {
            id: dashboardViews.changelog.id,
            label: "Changelog",
            icon: "Workflow",
            target: { kind: "command", commandId: "dashboard.openChangelog" },
          },
        ],
      },
    ],
    getFooter: () => [
      {
        id: dashboardViews.sessions.id,
        label: "Sessions",
        icon: "MessageCircle",
        target: { kind: "command", commandId: "dashboard.openSessions" },
      },
      {
        id: "help",
        label: "Help",
        icon: "CircleHelp",
        menuPath: dashboardHelpMenuPath,
        menuPlacement: "top-start",
      },
      {
        id: dashboardResources.settings.uri,
        label: "Project settings",
        icon: dashboardResources.settings.icon,
        resource: dashboardResources.settings,
      },
    ],
    getChildren: () => [],
  });
  ctx.layout.registerPanel({
    id: dashboardNavigationTreeViewId,
    title: "Acme",
    region: "sidenav",
    rendererId: dashboardNavigationTreeViewId,
  });
  ctx.layout.clearRegion("sidenav");
  ctx.layout.openPanel(dashboardNavigationTreeViewId);
};
