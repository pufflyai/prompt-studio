import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { DesktopRuntimeManager } from "./runtime-manager";

const options = {
  descriptorPath: "/tmp/cancelled-desktop-runtime.json",
  resolveSidecarPath: () => "/app/pstdio",
  onIntentionalShutdown() {},
  onUnexpectedExit() {},
  onPhase() {},
};

test("quitting during discovery prevents a late result from spawning a backend", async () => {
  const discovery = Promise.withResolvers<{ state: "missing" }>();
  let spawned = false;
  const manager = new DesktopRuntimeManager(options, {
    discoverRuntime: () => discovery.promise,
    existsSync: () => true,
    resolveEnvironment: async () => ({}),
    spawn: () => {
      spawned = true;
      throw new Error("Should not spawn after quit");
    },
  });
  const starting = manager.start();
  const result = starting.catch((error: unknown) => error);
  const cancelled = manager.cancelStart();
  discovery.resolve({ state: "missing" });
  await cancelled;
  expect(await result).toBeInstanceOf(Error);
  expect(spawned).toBe(false);
  expect(manager.runtime).toBeNull();
});

test("quitting during readiness waits for the exact spawned child to stop", async () => {
  const child = Object.assign(new EventEmitter(), {
    readOutput: () => "",
    kill: (signal?: NodeJS.Signals | number) => {
      signals.push(signal);
      queueMicrotask(() => child.emit("exit", null, signal));
      return true;
    },
  });
  const signals: (NodeJS.Signals | number | undefined)[] = [];
  const spawned = Promise.withResolvers<void>();
  const manager = new DesktopRuntimeManager(
    { ...options, descriptorPath: `/tmp/${randomUUID()}.json` },
    {
      existsSync: () => true,
      resolveEnvironment: async () => ({}),
      spawn: () => {
        spawned.resolve();
        return child;
      },
    },
  );
  const starting = manager.start();
  const result = starting.catch((error: unknown) => error);
  await spawned.promise;
  await manager.cancelStart();
  expect(await result).toBeInstanceOf(Error);
  expect(signals).toEqual(["SIGTERM"]);
  expect(manager.runtime).toBeNull();
});
