import type { PerformanceDiagnosticsAdapter } from "pstdio-api-contracts/performance-diagnostics";
import { pausedExtensions } from "@/shared/extensions/paused-extensions";
import type { PerformanceMonitoringController } from "./performance-monitoring-controller";

export const createPerformanceDiagnosticsAdapter = (controller: PerformanceMonitoringController) => {
  const adapter = {
    state: async () => ({ enabled: await controller.host.isEnabled(), host: controller.host.kind }),
    snapshotQuery: controller.snapshotQuery,
    snapshot: () => {
      controller.snapshotQuery.invalidate();
      return controller.snapshotQuery.read();
    },
    retain: controller.retainCapture,
    recordings: async () => controller.host.recordings?.() ?? null,
    subscribe: controller.subscribeSnapshots,
    control: async (request: Parameters<PerformanceDiagnosticsAdapter["control"]>[0]) => {
      // A manifest grant permits diagnostics, but cannot substitute for the person's local action.
      if (!navigator.userActivation?.isActive) throw new Error("Performance controls require a local user interaction");
      if (request.operation === "set-enabled") return controller.setEnabled(request.enabled);
      if (request.operation === "pause-extension") pausedExtensions.pause(request.installedExtensionId);
      if (request.operation === "resume-extension") pausedExtensions.resume(request.installedExtensionId);
    },
  };
  return adapter satisfies PerformanceDiagnosticsAdapter & { snapshotQuery: typeof controller.snapshotQuery };
};
