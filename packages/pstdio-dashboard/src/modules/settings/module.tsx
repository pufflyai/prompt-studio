import {
  type Disposable,
  standardResourceIcons,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
import { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { CloudStatusItem } from "@/shared/cloud/cloud-status-item";
import { machineTokensEnabled } from "@/shared/settings/synced-settings";
import {
  dashboardNavigationSections,
  registerDashboardNavigationContribution,
} from "@/shared/workbench/dashboard-navigation-contribution";
import { toDisposables } from "@/shared/workbench/disposable";
import {
  dashboardSettingsDefaultPanel,
  machineTokensSettingsPanel,
  registerDashboardSettingsContributions,
} from "./settings-contributions";

const createSettingsFooterNode = () => ({
  id: "dashboard.settings",
  label: "Settings",
  icon: standardResourceIcons.settings,
  canHide: true,
  target: {
    kind: "command" as const,
    commandId: WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
    args: { panelId: dashboardSettingsDefaultPanel.id },
  },
});

const registerSettingsSidenavs = (ctx: WorkbenchModuleContext) => {
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.settings.footer",
    modes: ["project"],
    slot: "footer",
    getSections: () => [{ ...dashboardNavigationSections.footer, nodes: [createSettingsFooterNode()] }],
  });
};

// The settings slice registers the dashboard's settings entries against the
// shared workbench settings surface. The surface owns the full-window overlay,
// its navigation, and the presenter — the dashboard only adds project scope, the
// sidenav entry points, and a command to open it.
export const createSettingsModule = () =>
  ({
    id: "dashboard.settings",
    activate(ctx) {
      registerDashboardSettingsContributions(ctx);
      ctx.views.registerView({
        id: "dashboard.cloud-sync",
        title: "Project sync",
        body: { kind: "react", render: () => <CloudStatusItem ctx={ctx} /> },
      });
      ctx.statusBar.registerItem({
        id: "dashboard.cloud-sync",
        viewId: "dashboard.cloud-sync",
        slot: "trailing",
        isVisible: () => !!getDashboardSelectedProjectId(ctx),
      });

      const surface = createWorkbenchSettingsModule({
        resolveScopeId: (scope) => (scope === "project" ? getDashboardSelectedProjectId(ctx) : undefined),
      }).activate(ctx);

      registerSettingsSidenavs(ctx);
      ctx.keybindings.registerKeybinding({ action: createSettingsFooterNode().target, keybinding: "Mod+," });

      // The surface registers the "Open settings" command itself; just surface it
      // in the dashboard's command palette menu.
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
        args: createSettingsFooterNode().target.args,
        order: 40,
      });

      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, () => ctx.settings.refresh());

      let machineTokensPanel: Disposable | undefined;
      const syncMachineTokensPanel = () => {
        const enabled = machineTokensEnabled();
        if (enabled && !machineTokensPanel) machineTokensPanel = ctx.settings.registerPanel(machineTokensSettingsPanel);
        if (!enabled && machineTokensPanel) {
          machineTokensPanel.dispose();
          machineTokensPanel = undefined;
        }
      };
      const unsubscribeSettings = subscribeCollections((change) => {
        if (!change || change.table === "settings") syncMachineTokensPanel();
      });
      syncMachineTokensPanel();

      return [
        ...toDisposables(surface),
        { dispose: unsubscribeProject },
        { dispose: unsubscribeSettings },
        { dispose: () => machineTokensPanel?.dispose() },
      ];
    },
  }) satisfies WorkbenchModuleContribution;
