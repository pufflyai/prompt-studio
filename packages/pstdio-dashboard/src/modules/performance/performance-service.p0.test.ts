import { expect, test } from "bun:test";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import type { PerformanceHost } from "./performance-host";
import { createPerformanceMonitoringController } from "./performance-monitoring-controller";
import { createPerformanceDiagnosticsAdapter } from "./performance-service";

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
  const controller = createPerformanceMonitoringController(host, {
    state: () => ({ supported: true, enabled, scope: "workbench" }),
    setEnabled: async (next) => {
      enabled = next;
    },
  });
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
    const owner = createHostEventPublisher();
    const other = createHostEventPublisher();
    await adapter.control({ operation: "set-render-overlay", enabled: true }, other);
    await adapter.control({ operation: "set-render-overlay", enabled: true }, owner);
    expect((await adapter.state()).renderOverlay?.enabled).toBe(true);
    other.unbind();
    expect(enabled).toBe(true);
    owner.unbind();
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
