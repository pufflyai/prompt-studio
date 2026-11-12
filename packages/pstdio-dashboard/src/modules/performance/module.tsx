import type { SettingsRegistry, WorkbenchModuleContribution } from "@pstdio/workbench";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { registerPerformanceDiagnostics } from "@/shared/app/performance-diagnostics";
import { createPerformanceHost } from "./performance-host";
import {
  createPerformanceMonitoringController,
  type PerformanceMonitoringController,
} from "./performance-monitoring-controller";
import { createPerformanceDiagnosticsAdapter } from "./performance-service";

/** Monitoring belongs to the renderer, so several workbenches in one window share one controller. */
export const createPerformanceMonitoring = () => {
  const bridge = (globalThis as { promptStudioDesktop?: unknown }).promptStudioDesktop;
  const controller = createPerformanceMonitoringController(
    createPerformanceHost(bridge, resolveDashboardStorage(undefined)),
  );
  void controller.load();
  return controller;
};

// Performance primitives remain available to extensions independently of Settings.
export const createPerformanceModule = (settings: SettingsRegistry, monitoring?: PerformanceMonitoringController) =>
  ({
    id: "dashboard.performance",
    activate() {
      // A standalone workbench owns its monitoring; a window's workbenches share the window's.
      const controller = monitoring ?? createPerformanceMonitoring();
      const unregisterController = registerPerformanceDiagnostics(
        settings,
        createPerformanceDiagnosticsAdapter(controller),
      );

      return [
        {
          dispose: () => {
            if (!monitoring) controller.dispose();
            unregisterController();
          },
        },
      ];
    },
  }) satisfies WorkbenchModuleContribution;
