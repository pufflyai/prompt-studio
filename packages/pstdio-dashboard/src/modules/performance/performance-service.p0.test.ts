import { expect, test } from "bun:test";
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
    await expect(adapter.control({ operation: "start-render-capture" })).rejects.toThrow("local user interaction");
    activation.isActive = true;
    const secondRelease = await controller.retainCapture();
    const owner = {};
    await adapter.control({ operation: "start-render-capture" }, owner);
    expect(overlay.readCapture()?.status).toBe("recording");
    await adapter.control({ operation: "set-render-overlay", enabled: true }, owner);
    expect((await adapter.state()).renderOverlay?.enabled).toBe(true);
    adapter.releaseControlOwner({});
    expect(enabled).toBe(true);
    adapter.releaseControlOwner(owner);
    expect(enabled).toBe(false);
    expect(overlay.readCapture()).toBeUndefined();
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
