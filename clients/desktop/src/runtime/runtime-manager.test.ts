import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { DesktopRuntimeManager } from "./runtime-manager";

const descriptor = {
  schemaVersion: 1 as const,
  protocolVersion: 1 as const,
  pid: 1234,
  instanceId: "runtime-one",
  ownerType: "desktop" as const,
  origin: "http://127.0.0.1:43127" as const,
  token: "runtime-secret",
  appVersion: "0.25.2",
  startedAt: "2026-08-06T08:00:00.000Z",
};

class RuntimeChild extends EventEmitter {
  exitOnKill = false;
  killedWith: NodeJS.Signals | number | undefined;
  killedSignals: (NodeJS.Signals | number | undefined)[] = [];
  stdout = new PassThrough();
  stderr = new PassThrough();

  kill(signal?: NodeJS.Signals | number) {
    this.killedWith = signal;
    this.killedSignals.push(signal);
    if (this.exitOnKill) queueMicrotask(() => this.emit("exit", null, signal));
    return true;
  }
}

describe("DesktopRuntimeManager", () => {
  test("refuses a different runtime that publishes the descriptor while the sidecar starts", async () => {
    const child = new RuntimeChild();
    child.exitOnKill = true;
    const replacement = { ...descriptor, instanceId: "replacement-runtime" };
    const discoveries = [{ state: "missing" as const }, { state: "healthy" as const, descriptor: replacement }];
    let spawnedArgs: string[] = [];
    const manager = new DesktopRuntimeManager(
      {
        descriptorPath: "/tmp/runtime.json",
        resolveSidecarPath: () => "/app/pstdio",
        onIntentionalShutdown: () => {},
        onUnexpectedExit: () => {},
        onPhase: () => {},
      },
      {
        createInstanceId: () => descriptor.instanceId,
        discoverRuntime: async () => discoveries.shift()!,
        existsSync: () => true,
        observeRuntimeShutdown: async () => {},
        sleep: () => new Promise(() => {}),
        spawn: (_path, args) => {
          spawnedArgs = args;
          return child;
        },
      },
    );

    await expect(manager.start()).rejects.toThrow("unexpected_exit");
    expect(spawnedArgs).toContain("--instance-id");
    expect(child.killedWith).toBe("SIGTERM");
  });

  test("waits for a failed sidecar to exit before reporting the startup failure", async () => {
    const child = new RuntimeChild();
    const replacement = { ...descriptor, instanceId: "replacement-runtime" };
    const discoveries = [{ state: "missing" as const }, { state: "healthy" as const, descriptor: replacement }];
    const manager = new DesktopRuntimeManager(
      {
        descriptorPath: "/tmp/runtime.json",
        resolveSidecarPath: () => "/app/pstdio",
        onIntentionalShutdown: () => {},
        onUnexpectedExit: () => {},
        onPhase: () => {},
      },
      {
        createInstanceId: () => descriptor.instanceId,
        discoverRuntime: async () => discoveries.shift()!,
        existsSync: () => true,
        observeRuntimeShutdown: async () => {},
        sleep: async () => {},
        spawn: () => child,
      },
    );

    const startup = manager.start();
    let settled = false;
    void startup.catch(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(child.killedSignals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(settled).toBe(false);

    child.emit("exit", null, "SIGKILL");
    await expect(startup).rejects.toThrow("unexpected_exit");
  });

  test("reports an unexpected child exit after a spawned runtime became ready", async () => {
    const child = new RuntimeChild();
    const discoveries = [{ state: "missing" as const }, { state: "healthy" as const, descriptor }];
    let unexpected = "";
    const manager = new DesktopRuntimeManager(
      {
        descriptorPath: "/tmp/runtime.json",
        resolveSidecarPath: () => "/app/pstdio",
        onIntentionalShutdown: () => {},
        onUnexpectedExit: (detail) => {
          unexpected = detail;
        },
        onPhase: () => {},
      },
      {
        createInstanceId: () => descriptor.instanceId,
        discoverRuntime: async () => discoveries.shift()!,
        existsSync: () => true,
        observeRuntimeShutdown: async () => {},
        sleep: async () => {},
        spawn: () => child,
      },
    );

    await expect(manager.start()).resolves.toMatchObject({ descriptor });
    child.stderr.write("runtime crashed");
    child.emit("exit", 1, null);

    expect(unexpected).toContain("runtime crashed");
  });

  test("treats a matching runtime control event as intentional", async () => {
    const child = new RuntimeChild();
    const discoveries = [{ state: "missing" as const }, { state: "healthy" as const, descriptor }];
    let intentional = 0;
    let unexpected = 0;
    const manager = new DesktopRuntimeManager(
      {
        descriptorPath: "/tmp/runtime.json",
        resolveSidecarPath: () => "/app/pstdio",
        onIntentionalShutdown: () => {
          intentional += 1;
        },
        onUnexpectedExit: () => {
          unexpected += 1;
        },
        onPhase: () => {},
      },
      {
        createInstanceId: () => descriptor.instanceId,
        discoverRuntime: async () => discoveries.shift()!,
        existsSync: () => true,
        observeRuntimeShutdown: async (_runtime, onShutdown) => onShutdown(),
        sleep: async () => {},
        spawn: () => child,
      },
    );

    await manager.start();
    child.emit("exit", 0, null);

    expect(intentional).toBe(1);
    expect(unexpected).toBe(0);
  });

  test("attaches an explicit external runtime without process ownership checks or sidecar selection", async () => {
    let discovered = false;
    let selectedSidecar = false;
    const manager = new DesktopRuntimeManager(
      {
        descriptorPath: "/isolated/runtime.json",
        externalRuntime: true,
        resolveSidecarPath: () => {
          selectedSidecar = true;
          return "/app/pstdio";
        },
        onIntentionalShutdown: () => {},
        onUnexpectedExit: () => {},
        onPhase: () => {},
      },
      {
        discoverRuntime: async () => {
          discovered = true;
          return { state: "missing" };
        },
        observeRuntimeShutdown: async () => {},
        readRuntimeDescriptor: () => descriptor,
        verifyExternalRuntime: async () => descriptor,
      },
    );

    await expect(manager.start()).resolves.toEqual({ descriptor, external: true });
    expect(discovered).toBe(false);
    expect(selectedSidecar).toBe(false);
  });
});
