import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeRuntimeDescriptor } from "pstdio/runtime";
import { initialDesktopState } from "../lifecycle/lifecycle-machine";
import { createQuitFlow } from "../lifecycle/quit-flow";
import { DesktopRuntimeManager } from "./runtime-manager";

test("waits for a starting runtime to stop before allowing quit", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-startup-quit-"));
  const requested = Promise.withResolvers<void>();
  const terminating = Promise.withResolvers<void>();
  const forceKill = Promise.withResolvers<void>();
  const signals: Array<NodeJS.Signals | number | undefined> = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    fetch: () => {
      requested.resolve();
      return new Promise<Response>(() => {});
    },
  });
  const child = Object.assign(new EventEmitter(), {
    readOutput: () => "",
    kill: (signal?: NodeJS.Signals | number) => {
      signals.push(signal);
      if (signal === "SIGTERM") terminating.resolve();
      if (signal === "SIGKILL") queueMicrotask(() => child.emit("exit", null, signal));
      return true;
    },
  });
  const descriptorPath = join(home, "runtime.json");
  const manager = new DesktopRuntimeManager(
    {
      descriptorPath,
      resolveSidecarPath: () => process.execPath,
      onIntentionalShutdown() {},
      onUnexpectedExit() {},
      onPhase() {},
    },
    {
      createInstanceId: () => "starting-runtime",
      resolveEnvironment: async () => ({ ...process.env }),
      sleep: (milliseconds) => (milliseconds === 2_000 ? forceKill.promise : Bun.sleep(milliseconds)),
      spawn: () => {
        writeRuntimeDescriptor(descriptorPath, {
          schemaVersion: 1,
          protocolVersion: 1,
          pid: process.pid,
          instanceId: "starting-runtime",
          ownerType: "desktop",
          origin: `http://127.0.0.1:${server.port!}`,
          token: "isolated-test-token",
          appVersion: "0.43.1",
          startedAt: new Date().toISOString(),
        });
        return child;
      },
    },
  );
  let quit = false;
  const flow = createQuitFlow({
    runtimeManager: manager,
    getState: () => initialDesktopState,
    setState() {},
    showLifecycle: async () => {},
    showQuitConfirmation: async () => {},
    askToCancelActiveWork: async () => true,
    flushBeforeQuit: async () => {},
    quitApp: () => {
      quit = true;
    },
    recoveryError: (error) => ({ code: "unexpected_exit", message: String(error), actions: ["quit"] }),
    logError() {},
  });
  const startup = manager.start().catch((error) => error);
  try {
    await requested.promise;
    const quitting = flow.requestQuit();
    await terminating.promise;
    expect(quit).toBe(false);
    expect(flow.isQuitAllowed()).toBe(false);
    expect(signals).toEqual(["SIGTERM"]);

    forceKill.resolve();
    await quitting;

    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(quit).toBe(true);
    expect(flow.isQuitAllowed()).toBe(true);
  } finally {
    forceKill.resolve();
    await startup;
    server.stop(true);
    rmSync(home, { recursive: true, force: true });
  }
});
