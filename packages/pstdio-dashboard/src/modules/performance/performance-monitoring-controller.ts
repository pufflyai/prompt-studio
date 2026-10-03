import type { PerformanceHost } from "./performance-host";
import { observeSlowFrames } from "./slow-frame-observer";

// Owns this renderer's slow-frame observer. It runs exactly while monitoring is
// on, so reopening the view never starts a second observer.
export const createPerformanceMonitoringController = (host: PerformanceHost) => {
  let enabled: boolean | undefined;
  let stopObserver: (() => void) | undefined;
  const listeners = new Set<() => void>();

  const apply = (next: boolean) => {
    enabled = next;
    if (next) stopObserver ??= observeSlowFrames(host.reportFrames);
    else {
      stopObserver?.();
      stopObserver = undefined;
    }
    for (const listener of listeners) listener();
  };

  return {
    host,
    load: async () => apply(await host.isEnabled()),
    getEnabled: () => enabled,
    setEnabled: async (next: boolean) => {
      // Stop observing before the host stops collecting, and start after it starts.
      if (!next) apply(false);
      await host.setEnabled(next);
      if (next) apply(true);
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      stopObserver?.();
      stopObserver = undefined;
      listeners.clear();
    },
  };
};

export type PerformanceMonitoringController = ReturnType<typeof createPerformanceMonitoringController>;
