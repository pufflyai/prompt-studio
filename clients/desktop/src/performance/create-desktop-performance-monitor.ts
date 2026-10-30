import { cpus } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import { type PerformanceBackend, readPerformanceRecordings } from "pstdio-diagnostics";
import { resolvePstdioPerformanceEndpoint } from "pstdio-paths";
import { createDesktopCapture } from "./create-performance-capture";
import { openPerformanceEndpoint } from "./performance-endpoint";
import { DesktopPerformanceMonitor } from "./performance-monitor";
import { PerformanceMonitoringPreference } from "./performance-preference";
import type { OwnedFrame } from "./process-attribution";

interface DesktopPerformanceMonitorInput {
  windows: () => { ownedFrames: () => OwnedFrame[]; runtimeOrigin: () => string | null } | null;
  backend: () => PerformanceBackend | null;
  logEndpointFailure: (error: unknown) => void;
}

export const createDesktopPerformanceMonitor = (input: DesktopPerformanceMonitorInput) => {
  const { windows, logEndpointFailure } = input;
  return new DesktopPerformanceMonitor({
    recordings: () => readPerformanceRecordings(join(app.getPath("userData"), "performance-recordings")),
    createCapture: () =>
      createDesktopCapture({
        backend: input.backend,
        executable: join(process.resourcesPath, "bin", process.platform === "win32" ? "pstdio.exe" : "pstdio"),
        recordingDirectory: join(app.getPath("userData"), "performance-recordings"),
        hostVersion: app.getVersion(),
        onError: logEndpointFailure,
      }),
    preference: new PerformanceMonitoringPreference(join(app.getPath("userData"), "performance-monitoring.json")),
    readMetrics: () => {
      const started = performance.now();
      try { return app.getAppMetrics(); }
      catch (error) { console.log("release-metrics-error", String(error)); throw error; }
      finally { console.log("release-metrics-ms", performance.now() - started); }
    },
    listFrames: () => {
      try { return windows()?.ownedFrames() ?? []; }
      catch (error) { console.log("release-frames-error", String(error)); throw error; }
    },
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
