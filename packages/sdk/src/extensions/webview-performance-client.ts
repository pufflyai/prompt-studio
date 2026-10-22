import type {
  PerformanceMonitoringState,
  PerformanceRecordingExport,
  PerformanceSnapshot,
} from "pstdio-api-contracts/performance-diagnostics";
import type { GuestHost } from "./guest-host";

export interface WebviewPerformanceClient {
  state(): Promise<PerformanceMonitoringState>;
  recordings(): Promise<PerformanceRecordingExport | null>;
  /** Keep one shared capture owner until this view releases it or disconnects. Does not enable monitoring. */
  retain(): Promise<() => Promise<void>>;
  snapshot(): Promise<PerformanceSnapshot | null>;
  setEnabled(enabled: boolean): Promise<void>;
  pauseExtension(installedExtensionId: string): Promise<void>;
  resumeExtension(installedExtensionId: string): Promise<void>;
  /** Listener lifetime belongs to this view. Does not start a collector. */
  subscribe(listener: (snapshot: PerformanceSnapshot | null) => void): Promise<() => Promise<void>>;
}

const captures = new WeakMap<GuestHost, { count: number; starting: Promise<unknown> }>();
const subscribers = new WeakMap<GuestHost, { count: number; starting: Promise<unknown> }>();

export const createWebviewPerformanceClient = (host: GuestHost): WebviewPerformanceClient => ({
  state: () => host.call("performance.read", { operation: "state" }) as Promise<PerformanceMonitoringState>,
  recordings: () =>
    host.call("performance.read", { operation: "recordings" }) as Promise<PerformanceRecordingExport | null>,
  snapshot: () => host.call("performance.read", { operation: "snapshot" }) as Promise<PerformanceSnapshot | null>,
  setEnabled: (enabled) => host.call("performance.control", { operation: "set-enabled", enabled }),
  pauseExtension: (installedExtensionId) =>
    host.call("performance.control", { operation: "pause-extension", installedExtensionId }),
  resumeExtension: (installedExtensionId) =>
    host.call("performance.control", { operation: "resume-extension", installedExtensionId }),
  retain: async () => {
    let shared = captures.get(host);
    if (!shared) {
      shared = { count: 0, starting: host.call("performance.read", { operation: "retain" }) };
      captures.set(host, shared);
    }
    shared.count++;
    try {
      await shared.starting;
    } catch (error) {
      shared.count--;
      if (shared.count === 0) captures.delete(host);
      throw error;
    }
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      shared.count--;
      if (shared.count === 0) {
        captures.delete(host);
        await host.call("performance.read", { operation: "dispose" });
      }
    };
  },
  subscribe: async (listener) => {
    const stop = host.onEvent("performance.read", (snapshot) => listener(snapshot as PerformanceSnapshot | null));
    let shared = subscribers.get(host);
    if (!shared) {
      shared = { count: 0, starting: host.call("performance.read", { operation: "subscribe" }) };
      subscribers.set(host, shared);
    }
    shared.count++;
    try {
      await shared.starting;
    } catch (error) {
      stop();
      shared.count--;
      if (shared.count === 0) subscribers.delete(host);
      throw error;
    }
    let stopped = false;
    return async () => {
      if (stopped) return;
      stopped = true;
      stop();
      shared.count--;
      if (shared.count === 0) {
        subscribers.delete(host);
        await host.call("performance.read", { operation: "unsubscribe" });
      }
    };
  },
});
