import { isCompositeFiber } from "bippy";
import { RENDER_CAPTURE_LIMITS, type ReactRenderCapture } from "pstdio-api-contracts/performance-diagnostics";
import type { Options } from "react-scan";
import { createRenderSummary } from "./render-capture";
import { detectRenderInputChange } from "./render-input-change";

interface Scanner {
  scan(options: Options): void;
  setOptions(options: Partial<Options>): unknown;
  isSupported(): boolean;
}

interface RenderOverlayOptions {
  scanner: Scanner;
  storage?: Pick<Storage, "removeItem">;
  setVisible(visible: boolean, active: boolean): void;
}

/** The pinned library has no dispose API. See ADR 0155 for the isolated lifecycle adaptation. */
export const createReactRenderOverlay = (options: RenderOverlayOptions) => {
  const { scanner, storage, setVisible } = options;
  let started = false;
  let highlighting = false;
  let result: ReactRenderCapture | undefined;
  let capture:
    | { until: number; timer: ReturnType<typeof setTimeout>; summary: ReturnType<typeof createRenderSummary> }
    | undefined;
  const clearSavedOptions = () => {
    try {
      storage?.removeItem("react-scan-options");
    } catch {
      // A window without storage also cannot restore the library's saved enabled preference.
    }
  };
  clearSavedOptions();
  scanner.setOptions({ enabled: false });
  clearSavedOptions();
  setVisible(false, false);

  const onRender: NonNullable<Options["onRender"]> = (fiber, renders) => {
    if (!capture || performance.now() >= capture.until || !isCompositeFiber(fiber)) return;
    for (const render of renders) {
      if (render.phase !== 2) continue; // React Scan's update phase excludes mounting and unmounting.
      if (capture.summary.full()) return;
      if (!render.componentName) {
        capture.summary.record(null, null, "unknown");
        continue;
      }
      // The production renderer may omit profiling fields. React Scan substitutes zero in that case.
      const time = typeof fiber.actualDuration === "number" ? render.time : null;
      capture.summary.record(render.componentName, time, detectRenderInputChange(fiber));
    }
  };
  const reconcile = () => {
    const enabled = highlighting || capture !== undefined;
    clearSavedOptions();
    if (enabled && !started) {
      scanner.scan({
        enabled: true,
        dangerouslyForceRunInProduction: true,
        showToolbar: false,
        log: false,
        allowInIframe: false,
        onRender,
      });
      started = true;
    } else scanner.setOptions({ enabled });
    clearSavedOptions();
    setVisible(highlighting, enabled);
  };
  const requireSupport = () => {
    if (!scanner.isSupported()) throw new Error("React Scan is unavailable in this build");
  };

  return {
    state: () => {
      const supported = scanner.isSupported();
      return { supported, captureSupported: supported, enabled: highlighting, scope: "workbench" as const };
    },
    setEnabled(enabled: boolean) {
      if (enabled) requireSupport();
      highlighting = enabled;
      reconcile();
    },
    readCapture: () => result,
    startCapture(onChange: () => void) {
      requireSupport();
      if (capture) throw new Error("A React render capture is already running");
      const startedAt = new Date().toISOString();
      const duration = RENDER_CAPTURE_LIMITS.durationMs;
      const summary = createRenderSummary();
      const timer = setTimeout(() => {
        capture = undefined;
        result = {
          status: "complete",
          startedAt,
          endedAt: new Date(Date.parse(startedAt) + duration).toISOString(),
          ...summary.finish(),
        };
        reconcile();
        onChange();
      }, duration);
      capture = { until: performance.now() + duration, timer, summary };
      result = { status: "recording", startedAt };
      try {
        reconcile();
      } catch (error) {
        clearTimeout(timer);
        capture = undefined;
        result = undefined;
        throw error;
      }
      onChange();
    },
    clearCapture() {
      if (!result) return;
      if (capture) clearTimeout(capture.timer);
      capture = undefined;
      result = undefined;
      reconcile();
    },
  };
};

export type ReactRenderOverlay = ReturnType<typeof createReactRenderOverlay>;
