import type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";
import { pausedExtensions } from "@/shared/extensions/paused-extensions";
import { createFrameRateCounter } from "./frame-rate";
import type { PerformanceHost } from "./performance-host";
import { observeSlowFrames } from "./slow-frame-observer";

// Owns this renderer's slow-frame observer and frame counter. Both run exactly
// while monitoring is on, so reopening the popover never starts a second one.
export const createPerformanceMonitoringController = (host: PerformanceHost) => {
  const frameRate = createFrameRateCounter();
  let enabled: boolean | undefined;
  let popoverOpen = false;
  let stopObserver: (() => void) | undefined;
  let stopStateReports: (() => void) | undefined;
  let disposed = false;
  let releaseCapture: (() => Promise<void>) | undefined;
  const listeners = new Set<() => void>();
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
      stopSnapshots ??= startSnapshots();
    } else {
      stopObserver?.();
      stopObserver = undefined;
      stopStateReports?.();
      stopStateReports = undefined;
      stopSnapshots?.();
      stopSnapshots = undefined;
      for (const listener of snapshotListeners) listener(null);
      popoverOpen = false;
    }
    for (const listener of listeners) listener();
  };

  return {
    host,
    frameRate,
    getPopoverOpen: () => popoverOpen,
    setPopoverOpen: (open: boolean) => {
      popoverOpen = open && enabled === true;
      for (const listener of listeners) listener();
    },
    retainCapture: async () => host.retainCapture?.() ?? (async () => {}),
    load: async () => {
      releaseCapture ??= await host.retainCapture?.();
      if (disposed) {
        await releaseCapture?.();
        return;
      }
      apply(await host.isEnabled());
    },
    getEnabled: () => enabled,
    setEnabled: async (next: boolean) => {
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
    },
    subscribeSnapshots: (listener: (snapshot: PerformanceSnapshot | null) => void) => {
      snapshotListeners.add(listener);
      return () => {
        snapshotListeners.delete(listener);
      };
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
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
      listeners.clear();
    },
  };
};

export type PerformanceMonitoringController = ReturnType<typeof createPerformanceMonitoringController>;
