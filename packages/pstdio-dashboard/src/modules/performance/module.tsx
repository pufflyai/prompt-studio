import type { SettingsRegistry, WorkbenchModuleContribution } from "@pstdio/workbench";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { registerPerformanceDiagnostics } from "@/shared/app/performance-diagnostics";
import { DeveloperToolsPanel } from "./components/developer-tools-panel";
import { createPerformanceHost } from "./performance-host";
import { createPerformanceMonitoringController } from "./performance-monitoring-controller";
import { createPerformanceDiagnosticsAdapter } from "./performance-service";

const SETTINGS_PANEL_ID = "developer-tools";
const SETTINGS_VIEW_ID = "dashboard.settings.developer-tools";

// Host performance primitives: this window's frame-rate and slow-frame observers, the diagnostics that
// extensions read, and the Developer tools panel that hosts their device-local controls. The meter,
// its popover and the monitoring switch belong to the Performance extension.
export const createPerformanceModule = (settings: SettingsRegistry) =>
  ({
    id: "dashboard.performance",
    activate(ctx) {
      const bridge = (globalThis as { promptStudioDesktop?: unknown }).promptStudioDesktop;
      const controller = createPerformanceMonitoringController(
        createPerformanceHost(bridge, resolveDashboardStorage(undefined)),
      );
      const unregisterController = registerPerformanceDiagnostics(
        settings,
        createPerformanceDiagnosticsAdapter(controller),
      );
      void controller.load();

      return [
        ctx.views.registerView({
          id: SETTINGS_VIEW_ID,
          title: "Developer tools",
          body: { kind: "react", render: () => <DeveloperToolsPanel /> },
        }),
        ctx.settings.registerPanel({
          kind: "view",
          id: SETTINGS_PANEL_ID,
          title: "Developer tools",
          section: "workbench",
          scope: "global",
          order: 40,
          icon: "Wrench",
          viewId: SETTINGS_VIEW_ID,
        }),
        {
          dispose: () => {
            controller.dispose();
            unregisterController();
          },
        },
      ];
    },
  }) satisfies WorkbenchModuleContribution;
