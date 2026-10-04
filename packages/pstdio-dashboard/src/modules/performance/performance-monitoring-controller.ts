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
  const listeners = new Set<() => void>();

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
    } else {
      stopObserver?.();
      stopObserver = undefined;
      stopStateReports?.();
      stopStateReports = undefined;
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
    load: async () => apply(await host.isEnabled()),
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
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      disposed = true;
      if (enabled) frameRate.stop();
      stopStateReports?.();
      stopObserver?.();
      stopObserver = undefined;
      listeners.clear();
    },
  };
};

export type PerformanceMonitoringController = ReturnType<typeof createPerformanceMonitoringController>;
