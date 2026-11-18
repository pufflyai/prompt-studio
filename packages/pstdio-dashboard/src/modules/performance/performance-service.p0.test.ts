import { expect, test } from "bun:test";
import { createExtensionWebviewHostCapabilities } from "@pstdio/workbench/extensions";
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
    const publisher = createHostEventPublisher();
    let disconnectCalls = 0;
    const owner = {
      ...publisher,
      onDisconnect: (listener: () => void) =>
        publisher.onDisconnect(() => {
          disconnectCalls++;
          listener();
        }),
    };
    const buildCapabilities = () => createExtensionWebviewHostCapabilities({ performance: adapter, hostEvents: owner });
    const other = createHostEventPublisher();
    await adapter.control({ operation: "set-render-overlay", enabled: true }, other);
    await buildCapabilities()["performance.control"]({ operation: "set-render-overlay", enabled: true });
    const refreshed = buildCapabilities();
    expect((await adapter.state()).renderOverlay?.enabled).toBe(true);
    other.unbind();
    expect(enabled).toBe(true);
    owner.unbind();
    expect(disconnectCalls).toBe(1);
    expect(enabled).toBe(false);
    expect(monitoring).toBe(true);
    await refreshed["performance.control"]({ operation: "set-render-overlay", enabled: true });
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
