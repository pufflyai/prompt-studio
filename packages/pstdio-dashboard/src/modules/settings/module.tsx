import {
  standardResourceIcons,
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
} from "pstdio-workbench/core";
import {
  createWorkbenchSettingsModule,
  settingsPanelResource,
  WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
} from "pstdio-workbench/react";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import {
  registerProjectSidebarContribution,
  registerWorkspaceSidebarContribution,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { toDisposables } from "@/shared/workbench/disposable";
import { dashboardSettingsDefaultPanel, registerDashboardSettingsContributions } from "./settings-contributions";

const settingsRootResource = settingsPanelResource(dashboardSettingsDefaultPanel);

const createSettingsFooterNode = () => ({
  id: settingsRootResource.uri,
  label: "Settings",
  icon: standardResourceIcons.settings,
  resource: settingsRootResource,
});

const registerSettingsSidebars = (ctx: WorkbenchModuleContributionContext) => {
  registerProjectSidebarContribution(ctx, {
    id: "dashboard.settings.project-sidebar",
    order: 40,
    getFooterNodes: () => [createSettingsFooterNode()],
  });
  registerWorkspaceSidebarContribution(ctx, {
    id: "dashboard.settings.workspace-sidebar",
    order: 40,
    getFooterNodes: () => [createSettingsFooterNode()],
  });
};

// The settings slice registers the dashboard's settings entries against the
// shared workbench settings surface. The surface owns the full-window overlay,
// its navigation, and the opener — the dashboard only adds project scope, the
// sidebar entry points, and a command to open it.
export const createSettingsModule = () =>
  ({
    id: "dashboard.settings",
    activate(ctx) {
      registerDashboardSettingsContributions(ctx);

      const surface = createWorkbenchSettingsModule({
        resolveScopeId: (scope) => (scope === "project" ? getDashboardSelectedProjectId(ctx) : undefined),
      }).activate(ctx);

      registerSettingsSidebars(ctx);

      // The surface registers the "Open settings" command itself; just surface it
      // in the dashboard's command palette menu.
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
        order: 40,
      });

      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, () => ctx.settings.refresh());

      return [...toDisposables(surface), { dispose: unsubscribeProject }];
    },
  }) satisfies WorkbenchModuleContribution;
