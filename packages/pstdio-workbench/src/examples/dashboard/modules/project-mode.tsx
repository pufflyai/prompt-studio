import type { WorkbenchModeActivationContext, WorkbenchModuleContributionContext } from "../../../core";
import {
  dashboardFooterTreeViewId,
  dashboardHelpMenuPath,
  dashboardNavigationTreeViewId,
  dashboardResources,
} from "../mock-data/data";

const registerDashboardProjectNavigation = (ctx: WorkbenchModeActivationContext) => [
  ctx.trees.registerTreeView({
    id: dashboardNavigationTreeViewId,
    title: "Acme",
    area: "left",
    defaultExpandedSectionIds: ["extensions"],
    getRoots: () => [],
    getSections: () => [
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
            icon: "KanbanSquare",
            resource: dashboardResources.tickets,
          },
          {
            id: dashboardResources.workspaces.uri,
            label: "Workspaces",
            icon: "GitBranch",
            resource: dashboardResources.workspaces,
          },
          {
            id: dashboardResources.sessions.uri,
            label: "Sessions",
            icon: "MessagesSquare",
            resource: dashboardResources.sessions,
          },
        ],
      },
      {
        id: "extensions",
        label: "project.sidebarNav",
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
    getChildren: () => [],
  }),
  ctx.trees.registerTreeView({
    id: dashboardFooterTreeViewId,
    title: "Acme footer",
    area: "left",
    role: "footer",
    getRoots: () => [],
    getSections: () => [
      {
        id: "footer",
        nodes: [
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
            icon: "Settings",
            resource: dashboardResources.settings,
          },
        ],
      },
    ],
    getChildren: () => [],
  }),
];

export const registerDashboardProjectMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: "project",
    label: "Project",
    activate: (modeCtx) => registerDashboardProjectNavigation(modeCtx),
  });
};
