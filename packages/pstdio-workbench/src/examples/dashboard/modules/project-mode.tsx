import type { WorkbenchModeActivationContext, WorkbenchModuleContributionContext } from "../../../core";
import { registerDashboardCollectionsTree } from "../collections/dashboard-collections";
import { dashboardHelpMenuPath, dashboardNavigationTreeViewId, dashboardResources } from "../mock-data/data";

const registerDashboardProjectNavigation = (ctx: WorkbenchModeActivationContext) => {
  const disposables = [
    ctx.renderers.registerTreeRenderer({
      id: dashboardNavigationTreeViewId,
      title: "Acme",
      defaultExpandedSectionIds: ["extensions"],
      getBody: () => [
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
      getFooter: () => [
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
      getChildren: () => [],
    }),
    ctx.layout.registerWidget({
      id: dashboardNavigationTreeViewId,
      title: "Acme",
      area: "left",
      rendererId: dashboardNavigationTreeViewId,
    }),
    ...registerDashboardCollectionsTree(ctx),
  ];
  ctx.layout.openWidget(dashboardNavigationTreeViewId);
  return disposables;
};

export const registerDashboardProjectMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: "project",
    label: "Project",
    activate: (modeCtx) => registerDashboardProjectNavigation(modeCtx),
  });
};
