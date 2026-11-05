import type { SettingsRegistry, WorkbenchModuleContribution } from "@pstdio/workbench";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { registerPerformanceDiagnostics } from "@/shared/app/performance-diagnostics";
import { createPerformanceHost } from "./performance-host";
import { createPerformanceMonitoringController } from "./performance-monitoring-controller";
import { createPerformanceDiagnosticsAdapter } from "./performance-service";

// Performance primitives remain available to extensions independently of Settings.
export const createPerformanceModule = (settings: SettingsRegistry) =>
  ({
    id: "dashboard.performance",
    activate() {
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
        {
          dispose: () => {
            controller.dispose();
            unregisterController();
          },
        },
      ];
    },
  }) satisfies WorkbenchModuleContribution;
