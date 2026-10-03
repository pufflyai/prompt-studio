import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import {
  PERFORMANCE_LIMITS,
  type PerformanceSnapshot,
  type SlowFrame,
  type SlowFrameReport,
  type SlowFrameSource,
} from "pstdio-api-contracts/performance-diagnostics";

// Where measurements come from and where the switch is saved. Desktop owns both
// in Electron main; a browser tab owns its slow frames and a local preference.
export interface PerformanceHost {
  kind: "desktop" | "browser";
  isEnabled: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
  snapshot: () => Promise<PerformanceSnapshot | null>;
  reportFrames: (report: SlowFrameReport) => void;
}

interface DesktopPerformanceBridge {
  getPerformanceMonitoring: () => Promise<boolean>;
  setPerformanceMonitoring: (enabled: boolean) => Promise<void>;
  getPerformanceSnapshot: () => Promise<PerformanceSnapshot | null>;
  reportSlowFrames: (report: SlowFrameReport) => Promise<void>;
}

export const BROWSER_PERFORMANCE_MONITORING_KEY = "pstdio-dashboard:performance-monitoring";

const hasPerformanceBridge = (bridge: unknown): bridge is DesktopPerformanceBridge =>
  Boolean(
    bridge &&
      typeof bridge === "object" &&
      "getPerformanceSnapshot" in bridge &&
      typeof bridge.getPerformanceSnapshot === "function",
  );

const desktopHost = (bridge: DesktopPerformanceBridge): PerformanceHost => ({
  kind: "desktop",
  isEnabled: () => bridge.getPerformanceMonitoring(),
  setEnabled: (enabled) => bridge.setPerformanceMonitoring(enabled),
  snapshot: () => bridge.getPerformanceSnapshot(),
  reportFrames: (report) => {
    // A report sent while monitoring turns off is dropped by main; nothing to recover.
    void bridge.reportSlowFrames(report).catch(() => {});
  },
});

const browserHost = (storage: WorkbenchStorageLike): PerformanceHost => {
  let enabled = storage.getItem(BROWSER_PERFORMANCE_MONITORING_KEY) === "true";
  let frames: SlowFrame[] = [];
  let source: SlowFrameSource | null = null;
  return {
    kind: "browser",
    isEnabled: async () => enabled,
    setEnabled: async (next) => {
      enabled = next;
      frames = [];
      source = null;
      if (next) storage.setItem(BROWSER_PERFORMANCE_MONITORING_KEY, "true");
      else storage.removeItem?.(BROWSER_PERFORMANCE_MONITORING_KEY);
    },
    snapshot: async () => {
      if (!enabled) return null;
      return {
        version: 1,
        host: "browser",
        capturedAt: new Date().toISOString(),
        sampleIntervalMs: null,
        warning: null,
        measurementWindowMs: null,
        capabilities: { processMetrics: false, idleWakeups: false, privateMemory: false, slowFrames: source },
        processes: [],
        frames,
      };
    },
    reportFrames: (report) => {
      if (!enabled) return;
      source = report.source;
      frames = [...[...report.frames].reverse(), ...frames].slice(0, PERFORMANCE_LIMITS.frames);
    },
  };
};

export const createPerformanceHost = (bridge: unknown, storage: WorkbenchStorageLike) =>
  hasPerformanceBridge(bridge) ? desktopHost(bridge) : browserHost(storage);
