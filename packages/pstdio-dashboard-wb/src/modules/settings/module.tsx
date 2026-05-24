import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardCommandIds } from "../../shared/commands";
import { disposeAll, toDisposables } from "../../shared/disposable";
import { activateModeChromeContributions } from "../../shared/mode-chrome-contributions";
import { getDashboardSelectedProjectId } from "../../shared/project-context";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardResources, dashboardSettingsResourceList } from "../../shared/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerWorkspaceSidebarContribution } from "../../shared/workspace-sidebar-contributions";
import { SettingsWidget } from "./components/settings-widget";
import { dashboardSettingsNavigationTreeViewId, registerSettingsNavigation } from "./settings-nav";

const registerSettingsWidget = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.settings,
      title: "Project settings",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.settings,
      priority: 60,
    },
    { priority: 60 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.settings,
    render: (input) => <SettingsWidget input={input} />,
  });
};

// The settings slice: the project settings panel, its navigation mode, and the
// resources that open into it.
export const createSettingsModule = () =>
  ({
    id: "dashboard.settings",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "project-settings", label: "Project settings", icon: "Settings" });
      registerSettingsWidget(ctx);
      registerWorkspaceSidebarContribution(ctx, {
        id: "dashboard.settings.workspace-sidebar",
        order: 40,
        getFooterNodes: () => [
          {
            id: dashboardResources.settings.uri,
            label: "Project settings",
            icon: "Settings",
            resource: dashboardResources.settings,
          },
        ],
      });
      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.openSettings,
          label: "Open project settings",
          category: "Dashboard",
          icon: "Settings",
        },
        { execute: () => ctx.resources.openResource(dashboardResources.settings, { replaceActive: true }) },
      );
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openSettings,
        order: 40,
      });

      ctx.modes.registerMode({
        id: "settings",
        label: "Settings",
        activate(modeCtx) {
          const settingsNavigation = registerSettingsNavigation(modeCtx);
          const modeChrome = activateModeChromeContributions(modeCtx, "settings");
          const disposables = [...toDisposables(settingsNavigation), ...toDisposables(modeChrome)];
          return { dispose: () => disposeAll(disposables) };
        },
      });

      ctx.resources.registerProvider({
        id: "dashboard-workbench.project-settings",
        kind: "project-settings",
        list: () => [
          { resource: dashboardResources.settings, group: "Settings" },
          ...dashboardSettingsResourceList.map((resource) => ({ resource, group: "Settings" })),
        ],
      });

      ctx.resources.registerOpener({
        id: "dashboard.settings.opener",
        priority: 1000,
        canOpen: (resource) => resource.kind === "project-settings",
        open: (resource, input) => {
          if (!getDashboardSelectedProjectId(ctx)) {
            ctx.modes.setActiveMode("project-selection");
            return undefined;
          }

          ctx.modes.setActiveMode("settings");
          setResourceBreadcrumb(ctx, resource);
          if (ctx.renderers.getTreeRenderer(dashboardSettingsNavigationTreeViewId)) {
            ctx.renderers.setSelectedNode(dashboardSettingsNavigationTreeViewId, resource.uri);
          }
          return ctx.layout.openWidget(dashboardWidgetIds.settings, {
            resource,
            title: resource.label,
            replaceActive: input.replaceActive,
          });
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
