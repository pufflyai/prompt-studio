import type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";
import { pausedExtensions } from "@/shared/extensions/paused-extensions";
import { createFrameRateCounter } from "./frame-rate";
import type { PerformanceHost } from "./performance-host";
import { observeSlowFrames } from "./slow-frame-observer";

// Owns this renderer's slow-frame observer and frame counter. Both run exactly
// while monitoring is on, so a second reader never starts a second one.
export const createPerformanceMonitoringController = (host: PerformanceHost) => {
  const frameRate = createFrameRateCounter();
  let enabled: boolean | undefined;
  let stopObserver: (() => void) | undefined;
  let stopStateReports: (() => void) | undefined;
  let disposed = false;
  let releaseCapture: (() => Promise<void>) | undefined;
  const snapshotListeners = new Set<(snapshot: PerformanceSnapshot | null) => void>();
  let stopSnapshots: (() => void) | undefined;
  const startSnapshots = () => {
    let active = true;
    let pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const snapshot = await host.snapshot();
        if (active) for (const listener of snapshotListeners) listener(snapshot);
      } finally {
        pending = false;
      }
    };
    const timer = setInterval(() => {
      void poll().catch(() => {});
    }, 2000);
    void poll().catch(() => {});
    return () => {
      active = false;
      clearInterval(timer);
    };
  };

  // The snapshot that people copy and agents read includes this window's state.
  const reportStateChanges = () => {
    const report = () =>
      host.reportState({ frameRate: frameRate.getBuckets(), pausedExtensionIds: [...pausedExtensions.get()] });
    report();
    const stopFrames = frameRate.subscribe(report);
    const stopPaused = pausedExtensions.subscribe(report);
    return () => {
      stopFrames();
      stopPaused();
    };
  };

  const apply = (next: boolean) => {
    if (disposed) return;
    if (next && !enabled) frameRate.start();
    if (!next && enabled) frameRate.stop();
    enabled = next;
    if (next) {
      stopObserver ??= observeSlowFrames(host.reportFrames);
      stopStateReports ??= reportStateChanges();
      if (snapshotListeners.size) stopSnapshots ??= startSnapshots();
    } else {
      stopObserver?.();
      stopObserver = undefined;
      stopStateReports?.();
      stopStateReports = undefined;
      stopSnapshots?.();
      stopSnapshots = undefined;
      for (const listener of snapshotListeners) listener(null);
    }
  };

  const setEnabled = async (next: boolean) => {
    // Stop observing before the host stops collecting, and start after it starts.
    if (!next) apply(false);
    try {
      await host.setEnabled(next);
    } catch (error) {
      // The host kept collecting, so this window keeps measuring too.
      if (!next) apply(true);
      throw error;
    }
    if (next) apply(true);
  };
  let leases = 0;

  return {
    host,
    // A loaded monitoring extension is the person's choice to measure, so monitoring runs exactly
    // while one holds a capture, and stops when the last one is disabled or unloaded.
    retainCapture: async () => {
      const release = (await host.retainCapture?.()) ?? (async () => {});
      leases += 1;
      if (leases === 1) await setEnabled(true);
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        leases -= 1;
        await release();
        if (leases === 0 && !disposed) await setEnabled(false);
      };
    },
    load: async () => {
      releaseCapture ??= await host.retainCapture?.();
      if (disposed) {
        await releaseCapture?.();
        return;
      }
      const saved = await host.isEnabled();
      // A monitoring extension may have switched it on while the saved switch was still loading.
      apply(leases > 0 || saved);
    },
    getEnabled: () => enabled,
    setEnabled,
    subscribeSnapshots: (listener: (snapshot: PerformanceSnapshot | null) => void) => {
      snapshotListeners.add(listener);
      if (enabled && !disposed) stopSnapshots ??= startSnapshots();
      return () => {
        snapshotListeners.delete(listener);
        if (!snapshotListeners.size) {
          stopSnapshots?.();
          stopSnapshots = undefined;
        }
      };
    },
    dispose: () => {
      disposed = true;
      void releaseCapture?.().catch(() => {});
      releaseCapture = undefined;
      if (enabled) frameRate.stop();
      stopStateReports?.();
      stopObserver?.();
      stopObserver = undefined;
      stopSnapshots?.();
      snapshotListeners.clear();
    },
  };
};

export type PerformanceMonitoringController = ReturnType<typeof createPerformanceMonitoringController>;
