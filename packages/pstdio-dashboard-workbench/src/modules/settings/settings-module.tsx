import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardCommandIds, dashboardWidgetIds } from "@/services/workbench/ids";
import { openSurfaceWidget } from "@/services/workbench/module-helpers";
import { dashboardResourceKindIds, settingsSectionResource } from "@/services/workbench/resources/resource-kinds";
import { SettingsPanel } from "./renderers/settings-panel";

// Settings surface: a single `main` widget whose active section is driven by the
// opened `settings-section` resource — replacing the dashboard `?panel=` state.
export const createSettingsModule = (projectId: string): WorkbenchModuleContribution => ({
  id: "pstdio-dashboard-workbench.settings",
  activate(ctx) {
    ctx.resources.registerKind({
      kind: dashboardResourceKindIds.settingsSection,
      label: "Settings",
      icon: "Settings",
    });

    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.settings,
      render: (input) => <SettingsPanel input={input} projectId={projectId} />,
    });

    ctx.layout.registerWidget({
      id: dashboardWidgetIds.settings,
      title: "Project settings",
      area: "main",
      singleton: true,
      closable: true,
      rendererId: dashboardWidgetIds.settings,
      resourceKinds: [dashboardResourceKindIds.settingsSection],
    });

    ctx.resources.registerOpener({
      id: "pstdio-dashboard-workbench.settings.opener",
      canOpen: (resource) => resource.kind === dashboardResourceKindIds.settingsSection,
      open: (resource, input) => openSurfaceWidget(ctx, dashboardWidgetIds.settings, resource, input),
    });

    ctx.commands.registerCommand(
      { id: dashboardCommandIds.openSettings, label: "Open project settings", category: "Dashboard", icon: "Settings" },
      { execute: () => ctx.resources.openResource(settingsSectionResource("general"), { replaceActive: true }) },
    );
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: dashboardCommandIds.openSettings,
      order: 40,
    });
  },
});
