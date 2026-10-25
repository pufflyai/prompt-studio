import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverRuntime, type RuntimeDescriptor, writeRuntimeDescriptor } from "pstdio/runtime";
import { DesktopRuntimeManager } from "./runtime-manager";

test("keeps its live process through a long startup step and retries without duplicating it", async () => {
  const root = mkdtempSync(join(tmpdir(), "desktop-startup-readiness-"));
  const descriptorPath = join(root, "runtime.json");
  const descriptor: RuntimeDescriptor = {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: process.pid,
    instanceId: "upgrading",
    ownerType: "desktop",
    origin: "http://127.0.0.1:43127",
    token: "isolated-startup-token",
    appVersion: "0.46.0",
    startedAt: new Date().toISOString(),
  };
  const signals: (NodeJS.Signals | number | undefined)[] = [];
  let probes = 0;
  let failNextProbe = false;
  let spawns = 0;
  const child = Object.assign(new EventEmitter(), {
    pid: process.pid,
    readOutput: () => JSON.stringify({ event: "runtime.startup.phase", phase: "database_retiring" }),
    kill: (signal?: NodeJS.Signals | number) => {
      signals.push(signal);
      queueMicrotask(() => child.emit("exit", null, signal));
      return true;
    },
  });
  const manager = new DesktopRuntimeManager(
    {
      descriptorPath,
      resolveSidecarPath: () => "/app/pstdio",
      onIntentionalShutdown() {},
      onUnexpectedExit() {},
      onPhase() {},
    },
    {
      createInstanceId: () => descriptor.instanceId,
      existsSync: () => true,
      resolveEnvironment: async () => ({}),
      observeRuntimeShutdown: async () => {},
      discoverRuntime: (path, options) =>
        discoverRuntime(path, {
          ...options,
          fetch: async () => {
            if (++probes <= 2 || failNextProbe) {
              failNextProbe = false;
              throw new TypeError("Readiness socket closed during startup");
            }
            return Response.json({ ok: true, protocolVersion: 1, instanceId: "upgrading", ownerType: "desktop" });
          },
        }),
      sleep: async () => {},
      spawn: () => {
        spawns += 1;
        writeRuntimeDescriptor(descriptorPath, descriptor);
        return child;
      },
    },
  );
  try {
    await expect(manager.start()).resolves.toEqual({ descriptor, external: false });
    expect(probes).toBe(3);
    expect(signals).toEqual([]);
    failNextProbe = true;
    await expect(manager.start()).rejects.toThrow("ownership is unsafe");
    expect(spawns).toBe(1);
    expect(signals).toEqual([]);
    await expect(manager.start()).resolves.toEqual({ descriptor, external: false });
    expect(spawns).toBe(1);
  } finally {
    await manager.detach();
    rmSync(root, { recursive: true, force: true });
  }
});
