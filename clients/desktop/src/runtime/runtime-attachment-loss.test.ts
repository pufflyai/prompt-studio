import { expect, test } from "bun:test";
import { DesktopRuntimeManager } from "./runtime-manager";

const descriptor = {
  schemaVersion: 1 as const,
  protocolVersion: 1 as const,
  pid: 1234,
  instanceId: "attached-runtime",
  ownerType: "persistent" as const,
  origin: "http://127.0.0.1:43127" as const,
  token: "runtime-secret",
  appVersion: "0.43.1",
  startedAt: "2026-10-16T08:00:00.000Z",
};

const attach = async (externalRuntime = false) => {
  let alive = true;
  let disconnected = () => {};
  let shutdown = () => {};
  let stoppedObserving = false;
  let intentionalShutdowns = 0;
  const failures: string[] = [];
  const manager = new DesktopRuntimeManager(
    {
      descriptorPath: "/tmp/attachment-loss-runtime.json",
      externalRuntime,
      resolveSidecarPath: () => {
        throw new Error("Attaching must not spawn a backend");
      },
      onIntentionalShutdown: () => {
        intentionalShutdowns += 1;
      },
      onUnexpectedExit: (detail) => failures.push(detail),
      onPhase() {},
    },
    {
      discoverRuntime: async () => ({ state: "healthy", descriptor }),
      readRuntimeDescriptor: () => descriptor,
      verifyExternalRuntime: async () => descriptor,
      isRuntimePidAlive: () => alive,
      observeRuntimeShutdown: async (_runtime, onShutdown, _fetch, signal, onDisconnect) => {
        shutdown = onShutdown;
        disconnected = onDisconnect ?? (() => {});
        signal?.addEventListener("abort", () => {
          stoppedObserving = true;
        });
      },
    },
  );
  await manager.start();
  return {
    manager,
    failures,
    disconnect: () => disconnected(),
    shutdown: () => shutdown(),
    exit: () => {
      alive = false;
    },
    stoppedObserving: () => stoppedObserving,
    intentionalShutdowns: () => intentionalShutdowns,
  };
};

test("detects an attached backend exit and releases the dead attachment once", async () => {
  const runtime = await attach();
  runtime.exit();
  runtime.disconnect();
  runtime.disconnect();
  expect(runtime.failures).toHaveLength(1);
  expect(runtime.manager.runtime).toBeNull();
  expect(runtime.manager.lastDescriptor).toEqual(descriptor);
  expect(runtime.stoppedObserving()).toBe(true);
});

test("keeps reconnecting while the attached process is alive", async () => {
  const runtime = await attach();
  runtime.disconnect();
  expect(runtime.failures).toEqual([]);
  expect(runtime.manager.runtime?.descriptor).toEqual(descriptor);
  runtime.manager.detach();
});

test.each(["detach", "shutdown", "external"])("does not recover after %s", async (reason) => {
  const runtime = await attach(reason === "external");
  if (reason === "detach") runtime.manager.detach();
  if (reason === "shutdown") runtime.shutdown();
  runtime.exit();
  runtime.disconnect();
  expect(runtime.failures).toEqual([]);
  runtime.manager.detach();
});

test("ignores a queued shutdown event after the attachment is detached", async () => {
  const runtime = await attach();
  runtime.manager.detach();
  runtime.shutdown();
  expect(runtime.intentionalShutdowns()).toBe(0);
});
