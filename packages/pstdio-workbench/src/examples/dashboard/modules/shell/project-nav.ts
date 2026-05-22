import type { WorkbenchModeActivationContext } from "../../../../core";
import { dashboardResources } from "../../shared/mock-data/resources";
import { buildFavoritesSection, buildSavedViewsSection } from "../tickets/collections/saved-views";
import { dashboardHelpMenuPath } from "./commands";

export const dashboardNavigationTreeViewId = "dashboard-workbench.navigation";

// Builds the project navigation tree shown in the left area while the "project"
// mode is active: primary views, extensions, favorites, and saved views.
export const registerProjectNavigation = (ctx: WorkbenchModeActivationContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardNavigationTreeViewId,
    title: "Acme",
    defaultExpandedSectionIds: ["extensions", "favorites", "views"],
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
            icon: "KanbanSquare",
            resource: dashboardResources.tickets,
          },
          {
            id: dashboardResources.workspaces.uri,
            label: "Workspaces",
            icon: "GitBranch",
            resource: dashboardResources.workspaces,
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
      await buildFavoritesSection(ctx),
      await buildSavedViewsSection(ctx),
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
        icon: "Settings",
        resource: dashboardResources.settings,
      },
    ],
    getChildren: () => [],
  });
  ctx.layout.registerWidget({
    id: dashboardNavigationTreeViewId,
    title: "Acme",
    area: "left",
    rendererId: dashboardNavigationTreeViewId,
  });
  ctx.favorites.onDidChange(() => ctx.renderers.refresh(dashboardNavigationTreeViewId));
  ctx.savedViews.onDidChange(() => ctx.renderers.refresh(dashboardNavigationTreeViewId));
  ctx.layout.clearArea("left");
  ctx.layout.openWidget(dashboardNavigationTreeViewId);
};
