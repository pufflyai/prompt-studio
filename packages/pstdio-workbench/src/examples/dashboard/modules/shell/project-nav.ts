import type { WorkbenchModeActivationContext } from "../../../../core";
import { dashboardResources } from "../../shared/mock-data/resources";
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
            id: dashboardResources.tickets.uri,
            label: "Tickets",
            icon: dashboardResources.tickets.icon,
            resource: dashboardResources.tickets,
          },
          {
            id: dashboardResources.workspaces.uri,
            label: "Workspaces",
            icon: dashboardResources.workspaces.icon,
            resource: dashboardResources.workspaces,
          },
        ],
      },
      {
        id: "extensions",
        label: "Extensions",
        collapsible: false,
        nodes: [
          { id: dashboardResources.lab.uri, label: "Lab", icon: "FlaskConical", resource: dashboardResources.lab },
          {
            id: dashboardResources.repoHealth.uri,
            label: "Repo health",
            icon: "GitBranch",
            resource: dashboardResources.repoHealth,
          },
          {
            id: dashboardResources.changelog.uri,
            label: "Changelog",
            icon: "Workflow",
            resource: dashboardResources.changelog,
          },
        ],
      },
    ],
    getFooter: () => [
      {
        id: dashboardResources.sessions.uri,
        label: "Sessions",
        icon: "MessageCircle",
        resource: dashboardResources.sessions,
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
    closable: false,
    id: dashboardNavigationTreeViewId,
    title: "Acme",
    region: "sidenav",
    rendererId: dashboardNavigationTreeViewId,
  });
  ctx.layout.clearRegion("sidenav");
  ctx.layout.openPanel(dashboardNavigationTreeViewId);
};
