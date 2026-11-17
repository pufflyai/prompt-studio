import { expect, test } from "bun:test";
import type { ReactRenderCapture } from "pstdio-api-contracts/performance-diagnostics";
import type { PerformanceHost } from "./performance-host";
import { createPerformanceMonitoringController } from "./performance-monitoring-controller";
import { createPerformanceDiagnosticsAdapter } from "./performance-service";
import { createReactRenderOverlay } from "./react-render-overlay";

test("render highlighting needs local activation and ends with its monitoring owner", async () => {
  let enabled = false;
  let monitoring = false;
  const host: PerformanceHost = {
    kind: "browser",
    isEnabled: async () => monitoring,
    setEnabled: async (next) => {
      monitoring = next;
    },
    snapshot: async () => null,
    reportFrames: () => {},
    reportState: () => {},
  };
  const overlay = createReactRenderOverlay({
    scanner: { isSupported: () => true, setOptions() {}, scan() {} },
    setVisible: (next) => {
      enabled = next;
    },
  });
  const controller = createPerformanceMonitoringController(host, overlay);
  const adapter = createPerformanceDiagnosticsAdapter(controller);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const activation = { isActive: false };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userActivation: activation } });
  try {
    await controller.load();
    const release = await controller.retainCapture();
    await expect(adapter.control({ operation: "set-render-overlay", enabled: true })).rejects.toThrow(
      "local user interaction",
    );
    expect(enabled).toBe(false);
    activation.isActive = true;
    const secondRelease = await controller.retainCapture();
    const owner = {};
    await adapter.control({ operation: "set-render-overlay", enabled: true }, owner);
    expect((await adapter.state()).renderOverlay?.enabled).toBe(true);
    adapter.releaseControlOwner({});
    expect(enabled).toBe(true);
    adapter.releaseControlOwner(owner);
    expect(enabled).toBe(false);
    expect(monitoring).toBe(true);
    await adapter.control({ operation: "set-render-overlay", enabled: true }, owner);
    await release();
    expect(enabled).toBe(true);
    await secondRelease();
    expect(enabled).toBe(false);
    await expect(adapter.control({ operation: "set-render-overlay", enabled: true })).rejects.toThrow(
      "Enable performance monitoring",
    );
  } finally {
    controller.dispose();
    if (previous) Object.defineProperty(globalThis, "navigator", previous);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("a CLI capture waits for desktop publication and can retry a rejected start", async () => {
  let start: (() => Promise<ReactRenderCapture>) | undefined;
  let failPublication = true;
  let pendingPublication: Promise<void> | undefined;
  const overlay = createReactRenderOverlay({
    scanner: { isSupported: () => true, scan() {}, setOptions() {} },
    setVisible() {},
  });
  const controller = createPerformanceMonitoringController(
    {
      kind: "desktop",
      isEnabled: async () => true,
      setEnabled: async () => {},
      snapshot: async () => null,
      reportFrames() {},
      async reportState(report) {
        if (report.renderCapture && failPublication) throw new Error("Desktop rejected publication");
        if (report.renderCapture) await pendingPublication;
      },
      onRenderCaptureRequest(listener) {
        start = listener;
        return () => {
          start = undefined;
        };
      },
    },
    overlay,
  );
  try {
    await controller.load();
    await expect(start!()).rejects.toThrow("Desktop rejected publication");
    expect(overlay.readCapture()).toBeUndefined();
    failPublication = false;
    const held = Promise.withResolvers<void>();
    pendingPublication = held.promise;
    const stopped = start!();
    await controller.setEnabled(false);
    await controller.setEnabled(true);
    pendingPublication = undefined;
    const replacement = await start!();
    held.resolve();
    await expect(stopped).rejects.toThrow("React render capture stopped");
    expect(overlay.readCapture()).toBe(replacement);
  } finally {
    controller.dispose();
  }
  expect(start).toBeUndefined();
  expect(overlay.readCapture()).toBeUndefined();
});
