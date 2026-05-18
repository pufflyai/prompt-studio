import type { WorkbenchModeActivationContext, WorkbenchModuleContributionContext } from "../../../core";
import {
  dashboardResources,
  dashboardSettingsNavigationTreeViewId,
  dashboardSettingsResources,
} from "../mock-data/data";

const registerDashboardSettingsNavigation = (ctx: WorkbenchModeActivationContext) => {
  const disposables = [
    ctx.renderers.registerTreeRenderer({
      id: dashboardSettingsNavigationTreeViewId,
      title: "Project settings",
      getBody: () => [
        {
          id: "settings-back",
          nodes: [
            {
              id: `${dashboardResources.tickets.uri}/back`,
              label: "Back to dashboard",
              icon: "KanbanSquare",
              resource: dashboardResources.tickets,
            },
          ],
        },
        {
          id: "settings",
          label: "Project settings",
          nodes: [
            {
              id: dashboardResources.settings.uri,
              label: "Overview",
              icon: "Settings",
              resource: dashboardResources.settings,
            },
            {
              id: dashboardSettingsResources.agents.uri,
              label: "Agents",
              icon: "Bot",
              resource: dashboardSettingsResources.agents,
            },
            {
              id: dashboardSettingsResources.repositories.uri,
              label: "Repositories",
              icon: "GitBranch",
              resource: dashboardSettingsResources.repositories,
            },
          ],
        },
        {
          id: "extension-settings",
          label: "Extensions",
          nodes: [
            {
              id: dashboardSettingsResources.labSettings.uri,
              label: "Lab settings",
              icon: "FlaskConical",
              resource: dashboardSettingsResources.labSettings,
            },
            {
              id: dashboardSettingsResources.auditLog.uri,
              label: "Audit log",
              icon: "ClipboardList",
              resource: dashboardSettingsResources.auditLog,
            },
            {
              id: dashboardSettingsResources.repoHealth.uri,
              label: "Repo health",
              icon: "GitBranch",
              resource: dashboardSettingsResources.repoHealth,
            },
          ],
        },
      ],
      getChildren: () => [],
    }),
    ctx.layout.registerWidget({
      id: dashboardSettingsNavigationTreeViewId,
      title: "Project settings",
      area: "left",
      rendererId: dashboardSettingsNavigationTreeViewId,
    }),
  ];
  ctx.layout.openWidget(dashboardSettingsNavigationTreeViewId);
  return disposables;
};

export const registerDashboardSettingsMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: "settings",
    label: "Settings",
    activate: (modeCtx) => registerDashboardSettingsNavigation(modeCtx),
  });
};
