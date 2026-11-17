import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";
import { pausedExtensions } from "@/shared/extensions/paused-extensions";
import { createFrameRateCounter } from "./frame-rate";
import type { PerformanceHost } from "./performance-host";
import type { ReactRenderOverlay } from "./react-render-overlay";
import { observeSlowFrames } from "./slow-frame-observer";

// Owns this renderer's slow-frame observer and frame counter. Both run exactly
// while monitoring is on, so a second reader never starts a second one.
export const createPerformanceMonitoringController = (host: PerformanceHost, renderOverlay?: ReactRenderOverlay) => {
  const frameRate = createFrameRateCounter();
  let enabled: boolean | undefined;
  let overlayOwner: object | undefined;
  const clearRenderCapture = () => {
    if (!renderOverlay?.readCapture()) return;
    renderOverlay.clearCapture();
    publishRendererState();
  };
  const stopOverlay = () => {
    overlayOwner = undefined;
    renderOverlay?.setEnabled(false);
    clearRenderCapture();
  };
  let stopObserver: (() => void) | undefined;
  let stopStateReports: (() => void) | undefined;
  let disposed = false;
  let releaseCapture: (() => Promise<void>) | undefined;
  let observingSnapshots = false;
  let stopSnapshots: (() => void) | undefined;
  const snapshots = createScopedQueryClient(
    { runtimeId: crypto.randomUUID(), extensionId: "pstdio.performance" },
    { maxInactive: 1 },
  );
  const snapshotQuery = snapshots.query<PerformanceSnapshot | null>({
    id: "performance.snapshot",
    async read(signal) {
      signal.throwIfAborted();
      if (!enabled) return null;
      const value = await host.snapshot();
      signal.throwIfAborted();
      return value;
    },
    subscribe(invalidate) {
      invalidate();
      observingSnapshots = true;
      if (enabled && !disposed) stopSnapshots ??= startSnapshots();
      return () => {
        observingSnapshots = false;
        stopSnapshots?.();
        stopSnapshots = undefined;
      };
    },
  });
  // Keep the established host cadence. Reading the source joins this owner, never another collector.
  const startSnapshots = () => {
    const timer = setInterval(() => snapshotQuery.invalidate(), 2000);
    return () => clearInterval(timer);
  };

  // The snapshot that people copy and agents read includes this window's state.
  const reportRendererState = () => {
    const renderCapture = renderOverlay?.readCapture();
    return host.reportState({
      frameRate: frameRate.getBuckets(),
      pausedExtensionIds: [...pausedExtensions.get()],
      ...(renderCapture ? { renderCapture } : {}),
    });
  };
  const publishRendererState = () => {
    // State updates can race renderer teardown. A CLI start waits for publication separately.
    void Promise.resolve(reportRendererState()).catch(() => {});
  };
  const stopRenderRequests = host.onRenderCaptureRequest?.(async () => {
    if (disposed || !enabled) throw new Error("Enable performance monitoring before capturing renders.");
    if (!renderOverlay) throw new Error("React Scan is unavailable in this build.");
    const recording = renderOverlay.startCapture(publishRendererState);
    try {
      await reportRendererState();
    } catch (error) {
      clearRenderCapture();
      throw error;
    }
    return recording;
  });
  const reportStateChanges = () => {
    publishRendererState();
    const stopFrames = frameRate.subscribe(publishRendererState);
    const stopPaused = pausedExtensions.subscribe(publishRendererState);
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
      if (observingSnapshots) stopSnapshots ??= startSnapshots();
      void snapshotQuery.refreshObserved().catch(() => {});
    } else {
      stopOverlay();
      stopObserver?.();
      stopObserver = undefined;
      stopStateReports?.();
      stopStateReports = undefined;
      stopSnapshots?.();
      stopSnapshots = undefined;
      snapshotQuery.accept(null);
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
    getRenderOverlay: () => renderOverlay?.state(),
    setRenderOverlayEnabled: (next: boolean, owner?: object) => {
      if (!renderOverlay) throw new Error("React Scan is unavailable in this build");
      if (next && !enabled) throw new Error("Enable performance monitoring before highlighting renders");
      renderOverlay.setEnabled(next);
      overlayOwner = next ? owner : undefined;
    },
    releaseControlOwner: (owner: object) => {
      if (owner === overlayOwner) {
        overlayOwner = undefined;
        renderOverlay?.setEnabled(false);
      }
    },
    snapshotQuery,
    // A loaded monitoring extension is the person's choice to measure, so monitoring runs exactly
    // while one holds a capture, and stops when the last one is disabled or unloaded.
    retainCapture: async () => {
      const release = (await host.retainCapture?.(true)) ?? (async () => {});
      leases += 1;
      // Desktop enablement belongs to the device-wide lease count. A project
      // only starts and stops its own renderer observers.
      if (leases === 1) {
        if (host.kind === "desktop") apply(true);
        else await setEnabled(true);
      }
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        leases -= 1;
        if (leases === 0) stopOverlay();
        await release();
        if (leases === 0 && !disposed) {
          if (host.kind === "desktop") {
            const active = await host.isEnabled();
            if (leases === 0 && !disposed) apply(active);
          } else await setEnabled(false);
        }
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
      let previous: PerformanceSnapshot | null | undefined;
      const changed = () => {
        const data = snapshotQuery.getSnapshot().data;
        if (data === undefined || data === previous) return;
        previous = data;
        listener(data);
      };
      const stop = snapshotQuery.subscribe(changed);
      changed();
      return stop;
    },
    dispose: () => {
      stopRenderRequests?.();
      stopOverlay();
      disposed = true;
      void releaseCapture?.().catch(() => {});
      releaseCapture = undefined;
      if (enabled) frameRate.stop();
      stopStateReports?.();
      stopObserver?.();
      stopObserver = undefined;
      stopSnapshots?.();
      snapshots.dispose();
    },
  };
};

export type PerformanceMonitoringController = ReturnType<typeof createPerformanceMonitoringController>;
