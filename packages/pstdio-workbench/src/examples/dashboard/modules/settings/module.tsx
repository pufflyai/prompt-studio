import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "../../../../core";
import { dashboardResources, dashboardSettingsResources } from "../../shared/mock-data/resources";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { SettingsWidget } from "./components/settings-widget";
import { registerSettingsNavigation } from "./settings-nav";

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
export const createSettingsModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.settings",
  activate(ctx) {
    registerSettingsWidget(ctx);

    ctx.modes.registerMode({
      id: "settings",
      label: "Settings",
      activate(modeCtx) {
        registerSettingsNavigation(modeCtx);
        return undefined;
      },
    });

    ctx.resources.registerProvider({
      id: "dashboard-workbench.project-settings",
      kind: "project-settings",
      list: () => [
        { resource: dashboardResources.settings, group: "Settings" },
        { resource: dashboardSettingsResources.agents, group: "Settings" },
        { resource: dashboardSettingsResources.repositories, group: "Settings" },
        { resource: dashboardSettingsResources.labSettings, group: "Settings" },
        { resource: dashboardSettingsResources.auditLog, group: "Settings" },
        { resource: dashboardSettingsResources.repoHealth, group: "Settings" },
      ],
    });

    ctx.resources.registerOpener({
      id: "dashboard.settings.opener",
      priority: 1000,
      canOpen: (resource) => resource.kind === "project-settings",
      open: (resource, input) => {
        ctx.modes.setActiveMode("settings");
        setResourceBreadcrumb(ctx, resource);
        return ctx.layout.openWidget(dashboardWidgetIds.settings, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        });
      },
    });
  },
});
