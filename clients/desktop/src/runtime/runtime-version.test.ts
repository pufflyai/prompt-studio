import { expect, test } from "bun:test";
import { DesktopRuntimeManager } from "./runtime-manager";

for (const externalRuntime of [false, true]) {
  test(`rejects a mismatched ${externalRuntime ? "external" : "local"} dashboard without stopping its runtime`, async () => {
    const descriptor = {
      schemaVersion: 1 as const,
      protocolVersion: 1 as const,
      pid: process.pid,
      instanceId: "older-runtime",
      ownerType: "persistent" as const,
      origin: "http://127.0.0.1:43127" as const,
      token: "test-token",
      appVersion: "0.31.0",
      startedAt: new Date().toISOString(),
    };
    const calls: string[] = [];
    const manager = new DesktopRuntimeManager(
      {
        appVersion: "0.33.1",
        descriptorPath: "/unused/runtime.json",
        externalRuntime,
        resolveSidecarPath: () => {
          calls.push("sidecar");
          return "/unused/pstdio";
        },
        onPhase: () => {},
        onIntentionalShutdown: () => {},
        onUnexpectedExit: () => {},
      },
      {
        discoverRuntime: async () => ({ state: "healthy", descriptor }),
        readRuntimeDescriptor: () => descriptor,
        verifyExternalRuntime: async () => descriptor,
        observeRuntimeShutdown: async () => {
          calls.push("attached");
        },
        requestRuntimeShutdown: async () => {
          calls.push("shutdown");
          return { state: "accepted" };
        },
      },
    );
    await expect(manager.start()).rejects.toThrow("version_mismatch:");
    expect(manager.runtime).toBeNull();
    expect(calls).toEqual([]);
    descriptor.appVersion = "0.33.1";
    expect(await manager.start()).toEqual({ descriptor, external: externalRuntime });
    expect(calls).toEqual(["attached"]);
    manager.detach();
  });
}
