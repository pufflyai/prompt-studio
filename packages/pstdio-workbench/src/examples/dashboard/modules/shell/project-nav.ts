import type { WorkbenchModeActivationContext } from "../../../../core";
import { dashboardResources, dashboardViews } from "../../shared/mock-data/resources";
import { dashboardHelpMenuPath } from "./commands";

export const dashboardNavigationTreeViewId = "dashboard-workbench.navigation";

// Builds the project navigation tree shown in the Sidenav while the
// "project" mode is active.
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
            target: { kind: "view", viewId: dashboardViews.tickets.id },
          },
          {
            id: dashboardViews.workspaces.id,
            label: "Workspaces",
            icon: dashboardViews.workspaces.icon,
            target: { kind: "view", viewId: dashboardViews.workspaces.id },
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
            target: { kind: "view", viewId: dashboardViews.lab.id },
          },
          {
            id: dashboardViews.repoHealth.id,
            label: "Repo health",
            icon: "GitBranch",
            target: { kind: "view", viewId: dashboardViews.repoHealth.id },
          },
          {
            id: dashboardViews.changelog.id,
            label: "Changelog",
            icon: "Workflow",
            target: { kind: "view", viewId: dashboardViews.changelog.id },
          },
        ],
      },
    ],
    getFooter: () => [
      {
        id: dashboardViews.sessions.id,
        label: "Sessions",
        icon: "MessageCircle",
        target: { kind: "view", viewId: dashboardViews.sessions.id },
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
