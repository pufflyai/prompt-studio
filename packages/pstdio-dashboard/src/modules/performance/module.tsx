import { type Disposable, type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { DeveloperToolsPanel } from "./components/developer-tools-panel";
import { PerformanceStatusItem } from "./components/performance-status-item";
import { createPerformanceHost } from "./performance-host";
import { createPerformanceMonitoringController } from "./performance-monitoring-controller";

const SETTINGS_PANEL_ID = "performance";
const SETTINGS_VIEW_ID = "dashboard.settings.performance";

// Developer tools: the device-local performance switch, the frame-rate meter in
// the status bar with its popover, and commands that open it or copy a snapshot.
export const createPerformanceModule = () =>
  ({
    id: "dashboard.performance",
    activate(ctx) {
      const bridge = (globalThis as { promptStudioDesktop?: unknown }).promptStudioDesktop;
      const controller = createPerformanceMonitoringController(
        createPerformanceHost(bridge, resolveDashboardStorage(undefined)),
      );
      void controller.load();

      // The meter and its view exist only while monitoring is on, so nothing of it
      // stays mounted, even hidden, after the switch turns off.
      let statusItem: Disposable | undefined;
      const syncStatusItem = () => {
        const enabled = controller.getEnabled() === true;
        if (enabled && !statusItem) {
          const view = ctx.views.registerView({
            id: dashboardWidgetIds.performance,
            title: "Performance",
            body: {
              kind: "react",
              render: () => (
                <PerformanceStatusItem controller={controller} projectId={getDashboardSelectedProjectId(ctx)} />
              ),
            },
          });
          const item = ctx.statusBar.registerItem({
            id: dashboardWidgetIds.performance,
            viewId: dashboardWidgetIds.performance,
            slot: "trailing",
          });
          statusItem = {
            dispose: () => {
              item.dispose();
              view.dispose();
            },
          };
        }
        if (!enabled && statusItem) {
          statusItem.dispose();
          statusItem = undefined;
        }
      };
      const stopSync = controller.subscribe(syncStatusItem);

      const showPerformance = async () => {
        // A mode that draws its own status bar hides the meter, so the setting is the only place left.
        const mode = ctx.modes.getMode(ctx.modes.getActiveModeId() ?? "");
        if (!statusItem || mode?.chrome?.status !== undefined) {
          await ctx.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: SETTINGS_PANEL_ID });
          return;
        }
        controller.setPopoverOpen(true);
      };

      ctx.settings.registerSection({ id: "developer-tools", title: "Developer tools", order: 25, scope: "global" });
      const disposables = [
        ctx.views.registerView({
          id: SETTINGS_VIEW_ID,
          title: "Performance",
          body: { kind: "react", render: () => <DeveloperToolsPanel controller={controller} /> },
        }),
        ctx.settings.registerPanel({
          kind: "view",
          id: SETTINGS_PANEL_ID,
          title: "Performance",
          section: "developer-tools",
          scope: "global",
          order: 10,
          icon: "Gauge",
          viewId: SETTINGS_VIEW_ID,
        }),
        ctx.commands.registerCommand(
          { id: dashboardCommandIds.openPerformance, label: "Show performance", category: "Developer", icon: "Gauge" },
          { execute: showPerformance },
        ),
        ctx.commands.registerCommand(
          {
            id: dashboardCommandIds.copyPerformanceSnapshot,
            label: "Copy performance snapshot",
            category: "Developer",
            icon: "Copy",
          },
          {
            execute: async () => {
              const snapshot = await controller.host.snapshot();
              if (!snapshot)
                throw new Error("Performance monitoring is off. Turn it on in Settings → Developer tools.");
              await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
              ctx.notifications.show({ level: "success", title: "Performance snapshot copied" });
            },
          },
        ),
        ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
          commandId: dashboardCommandIds.openPerformance,
          order: 46,
        }),
      ];
      return [
        ...disposables,
        {
          dispose: () => {
            stopSync();
            statusItem?.dispose();
            controller.dispose();
          },
        },
      ];
    },
  }) satisfies WorkbenchModuleContribution;
