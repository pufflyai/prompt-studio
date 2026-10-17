import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { DesktopRuntimeManager } from "../runtime/runtime-manager";
import { type DesktopState, initialDesktopState, transitionDesktopState } from "./lifecycle-machine";
import { createQuitFlow } from "./quit-flow";
import { createRuntimeRecovery } from "./runtime-recovery";

test("quitting cancels automatic recovery before flushing and never leaves a backend behind", async () => {
  const original = {
    schemaVersion: 1 as const,
    protocolVersion: 1 as const,
    pid: 1234,
    instanceId: "original",
    ownerType: "persistent" as const,
    origin: "http://127.0.0.1:43127" as const,
    token: "secret",
    appVersion: "0.43.1",
    startedAt: "2026-10-16T08:00:00Z",
  };
  const replacement = { ...original, instanceId: "replacement", pid: 1235, ownerType: "desktop" as const };
  const discovering = Promise.withResolvers<void>();
  const flushStarted = Promise.withResolvers<void>();
  const flushed = Promise.withResolvers<void>();
  let alive = true;
  let disconnect = () => {};
  let discoveryCalls = 0;
  let recover: Promise<void> | undefined;
  let state: DesktopState = initialDesktopState;
  const calls: string[] = [];
  const child = Object.assign(new EventEmitter(), {
    kill: () => {
      calls.push("kill");
      return true;
    },
    readOutput: () => "",
  });
  const manager = new DesktopRuntimeManager(
    {
      descriptorPath: "/unused/runtime.json",
      resolveSidecarPath: () => "/app/pstdio",
      onIntentionalShutdown: () => {},
      onUnexpectedExit: (detail) => {
        recover = recovery.recover(new Error(detail));
      },
      onPhase: (phase) => {
        state = { kind: "starting", phase };
      },
    },
    {
      discoverRuntime: async () => {
        discoveryCalls += 1;
        if (discoveryCalls === 1) return { state: "healthy", descriptor: original };
        if (discoveryCalls === 2) {
          await discovering.promise;
          return { state: "missing" };
        }
        return { state: "healthy", descriptor: replacement };
      },
      isRuntimePidAlive: () => alive,
      observeRuntimeShutdown: async (_descriptor, _shutdown, _fetch, _signal, onDisconnect) => {
        disconnect = onDisconnect!;
      },
      existsSync: () => true,
      createInstanceId: () => replacement.instanceId,
      resolveEnvironment: async () => ({}),
      spawn: () => {
        calls.push("spawn");
        return child;
      },
    },
  );
  const recovery = createRuntimeRecovery({
    canRestart: () => !quit.isQuitting() && state.kind === "workbench",
    start: async () => {
      state = initialDesktopState;
      const runtime = await manager.start();
      state = transitionDesktopState(state, { type: "runtime_ready", runtime: runtime.descriptor });
    },
    showFailure: async () => {
      if (!quit.isQuitting()) calls.push("failure");
    },
  });
  const quit = createQuitFlow({
    runtimeManager: {
      cancelStart: () => manager.cancelStart(),
      refreshRuntime: () => manager.refreshRuntime(),
      requestShutdown: (force) => manager.requestShutdown(force),
      waitForExit: () => manager.waitForExit(),
      detach: () => {
        calls.push("detach");
        return manager.detach();
      },
    },
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    showLifecycle: async () => {},
    showQuitConfirmation: async () => {},
    askToCancelActiveWork: async () => false,
    flushBeforeQuit: async () => {
      calls.push("flush");
      flushStarted.resolve();
      await flushed.promise;
    },
    quitApp: () => {
      calls.push("quitApp");
    },
    recoveryError: (error) => ({ code: "unexpected_exit", message: String(error), actions: ["quit"] }),
    logError: () => {},
  });
  await recovery.start();
  alive = false;
  disconnect();
  const quitting = quit.requestQuit();
  expect(quit.isQuitting()).toBe(true);
  expect(calls).toEqual([]);
  discovering.resolve();
  await flushStarted.promise;
  await recover;
  expect(calls).toEqual(["detach", "flush"]);
  expect(manager.runtime).toBeNull();
  flushed.resolve();
  await quitting;
  expect(calls).toEqual(["detach", "flush", "quitApp"]);
  manager.detach();
});
