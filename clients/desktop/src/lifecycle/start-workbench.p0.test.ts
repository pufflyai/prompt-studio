import { expect, test } from "bun:test";
import type { ManagedRuntime } from "../runtime/runtime-manager";
import { startWorkbench } from "./start-workbench";

const runtime: ManagedRuntime = {
  external: false,
  descriptor: {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: 1234,
    instanceId: "existing-runtime",
    ownerType: "persistent",
    origin: "http://127.0.0.1:43127",
    token: "test-token",
    appVersion: "0.33.1",
    startedAt: "2026-09-14T00:00:00.000Z",
  },
};

test("loads the attached workbench while lifecycle resources are still loading", async () => {
  const lifecycle = Promise.withResolvers<void>();
  let workbenchLoaded = false;
  const startup = startWorkbench(
    {
      showLifecycle: () => lifecycle.promise,
      prepareWorkbench: async () => {},
      showWorkbench: async (descriptor) => {
        expect(descriptor).toBe(runtime.descriptor);
        workbenchLoaded = true;
      },
    },
    { start: async () => runtime, cancelStart: async () => {} },
  );
  try {
    await Bun.sleep(0);
    expect(workbenchLoaded).toBe(true);
  } finally {
    lifecycle.resolve();
    await expect(startup).resolves.toBe(runtime);
  }
});

test("prepares the workbench while its runtime starts and reveals it only after readiness", async () => {
  const ready = Promise.withResolvers<ManagedRuntime>();
  let prepared = false;
  let revealed = false;
  const startup = startWorkbench(
    {
      showLifecycle: async () => {},
      prepareWorkbench: async (descriptor, runtimeReady) => {
        expect(runtimeReady).toBe(ready.promise);
        expect(descriptor).toBe(runtime.descriptor);
        prepared = true;
      },
      showWorkbench: async () => {
        revealed = true;
      },
    },
    {
      cancelStart: async () => {},
      start: (onStarting?: (descriptor: ManagedRuntime["descriptor"]) => void) => {
        onStarting?.(runtime.descriptor);
        return ready.promise;
      },
    },
  );
  try {
    await Promise.resolve();
    expect(prepared).toBe(true);
    expect(revealed).toBe(false);
  } finally {
    ready.resolve(runtime);
    await startup;
  }
  expect(revealed).toBe(true);
});

test("cancels pending runtime readiness after preparation fails and waits for cleanup", async () => {
  const ready = Promise.withResolvers<ManagedRuntime>();
  const cleanup = Promise.withResolvers<void>();
  const failure = new Error("workbench_unavailable: Fixture bundle failed");
  let cancelled = false;
  let settled = false;
  let revealed = false;
  const startup = startWorkbench(
    {
      showLifecycle: async () => {},
      prepareWorkbench: async () => {
        throw failure;
      },
      showWorkbench: async () => {
        revealed = true;
        throw failure;
      },
    },
    {
      start: (onStarting?: (descriptor: ManagedRuntime["descriptor"]) => void) => {
        onStarting?.(runtime.descriptor);
        return ready.promise;
      },
      cancelStart: async () => {
        cancelled = true;
        ready.reject(new Error("Runtime startup cancelled"));
        await cleanup.promise;
      },
    },
  ).catch((error: unknown) => {
    settled = true;
    return error;
  });
  try {
    await Bun.sleep(0);
    expect(cancelled).toBe(true);
    expect(settled).toBe(false);
    expect(revealed).toBe(false);
  } finally {
    ready.resolve(runtime);
    cleanup.resolve();
    expect(await startup).toBe(failure);
  }
});

test("preserves the runtime startup failure when early browser login fails", async () => {
  const ready = Promise.withResolvers<ManagedRuntime>();
  const runtimeFailure = new Error("pglite_recovery_failure: Fixture database failed to open");
  const startup = startWorkbench(
    {
      showLifecycle: async () => {},
      prepareWorkbench: async () => {
        throw new Error("Runtime browser login failed with status 503");
      },
      showWorkbench: async () => {
        throw new Error("Failed runtime must not reveal a workbench");
      },
    },
    {
      start: (onStarting?: (descriptor: ManagedRuntime["descriptor"]) => void) => {
        onStarting?.(runtime.descriptor);
        return ready.promise;
      },
      cancelStart: async () => {},
    },
  ).catch((error: unknown) => error);
  await Bun.sleep(0);
  ready.reject(runtimeFailure);
  expect(await startup).toBe(runtimeFailure);
});

test("preserves a diagnosed runtime failure when its asset request fails first", async () => {
  const ready = Promise.withResolvers<ManagedRuntime>();
  const runtimeFailure = new Error("pglite_recovery_failure: Fixture database failed to open");
  const startup = startWorkbench(
    {
      showLifecycle: async () => {},
      prepareWorkbench: async () => {
        throw new Error("workbench_unavailable: The workbench app files could not load");
      },
      showWorkbench: async () => {
        throw new Error("Failed runtime must not reveal a workbench");
      },
    },
    {
      start: (onStarting?: (descriptor: ManagedRuntime["descriptor"]) => void) => {
        onStarting?.(runtime.descriptor);
        return ready.promise;
      },
      cancelStart: async () => {
        ready.reject(runtimeFailure);
        await ready.promise.catch(() => {});
      },
    },
  ).catch((error: unknown) => error);
  expect(await startup).toBe(runtimeFailure);
});
