import { cpus } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import { resolvePstdioPerformanceEndpoint } from "pstdio-paths";
import { openPerformanceEndpoint } from "./performance-endpoint";
import { DesktopPerformanceMonitor } from "./performance-monitor";
import { PerformanceMonitoringPreference } from "./performance-preference";
import type { OwnedFrame } from "./process-attribution";

interface DesktopPerformanceMonitorInput {
  windows: () => { ownedFrames: () => OwnedFrame[]; runtimeOrigin: () => string | null } | null;
  logEndpointFailure: (error: unknown) => void;
}

export const createDesktopPerformanceMonitor = (input: DesktopPerformanceMonitorInput) => {
  const { windows, logEndpointFailure } = input;
  return new DesktopPerformanceMonitor({
    preference: new PerformanceMonitoringPreference(join(app.getPath("userData"), "performance-monitoring.json")),
    readMetrics: () => app.getAppMetrics(),
    listFrames: () => windows()?.ownedFrames() ?? [],
    runtimeOrigin: () => windows()?.runtimeOrigin() ?? null,
    platform: process.platform,
    cpuCount: cpus().length,
    openEndpoint: async (read) => {
      try {
        return await openPerformanceEndpoint(resolvePstdioPerformanceEndpoint(), read);
      } catch (error) {
        // The app keeps its own view; only `pst performance` loses the snapshot.
        logEndpointFailure(error);
        return { close: async () => {} };
      }
    },
  });
};
