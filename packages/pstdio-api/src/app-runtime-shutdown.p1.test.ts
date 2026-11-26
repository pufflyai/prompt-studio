import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppCloser, createRuntimeRouteDeps } from "./app-runtime";
import { createTestHarnessRecord, createTestHarnessRegistry } from "./features/harnesses/test-harness-registry";
import type { RuntimeHost } from "./features/runtime/routes";
import { createTestApp } from "./test-utils/create-test-app";

test("a blocked shutdown records its entered phase when ordinary request logs are disabled", async () => {
  const root = await mkdtemp(join(tmpdir(), "runtime-shutdown-phase-"));
  const previous = { path: process.env.PSTDIO_LOG_PATH, level: process.env.PSTDIO_LOG_LEVEL };
  const path = join(root, "logs.jsonl");
  process.env.PSTDIO_LOG_PATH = path;
  process.env.PSTDIO_LOG_LEVEL = "error";
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const harness = createTestHarnessRecord("worker", {
    provider: {
      dispose: async () => {
        entered.resolve();
        await release.promise;
      },
    },
  });
  let app: Awaited<ReturnType<typeof createTestApp>> | undefined;
  let closing: Promise<void> | undefined;
  try {
    app = await createTestApp({ harnessRegistry: createTestHarnessRegistry([harness]) });
    await (await app.deps.harnessRegistry.get(harness.id))!.capabilities({ projectId: "p1" });
    closing = app.close();
    await entered.promise;
    // Other shutdown phases can append while the file is being read.
    const lines = (await readFile(path, "utf8")).split("\n");
    const entries = lines.slice(0, -1).map((line) => JSON.parse(line));
    expect(entries).toContainEqual(
      expect.objectContaining({
        event: "runtime.shutdown.phase",
        phase: "harnesses",
        state: "started",
      }),
    );
  } finally {
    release.resolve();
    await (closing ?? app?.close());
    if (previous.path === undefined) delete process.env.PSTDIO_LOG_PATH;
    else process.env.PSTDIO_LOG_PATH = previous.path;
    if (previous.level === undefined) delete process.env.PSTDIO_LOG_LEVEL;
    else process.env.PSTDIO_LOG_LEVEL = previous.level;
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
  ["cleanup succeeds", false, false],
  ["process and worker cleanup fail", true, false],
  ["process, worker, and database cleanup fail", true, true],
] as const)("an early shutdown failure still closes extension processes when %s", async (_, stopFails, dbFails) => {
  const runtimeFailure = new Error("extension runtime did not stop");
  const processFailure = new Error("process cleanup failed");
  const workerFailure = new Error("worker cleanup failed");
  const databaseFailure = new Error("database cleanup failed");
  const order: string[] = [];
  const done = async () => {};
  const close = createAppCloser({
    closeBackendWorkers: async () => {
      order.push("workers");
      if (stopFails) throw workerFailure;
    },
    startupAbort: new AbortController(),
    startupDone: Promise.resolve(),
    getStartupBackgroundDone: done,
    notificationWakeTimer: setInterval(() => {}, 60_000),
    stopDeadRowCleanup: done,
    unsubscribeExtensionEvents: () => {},
    extensionRuntime: {
      dispose: async () => {
        throw runtimeFailure;
      },
    },
    extensionScheduler: { dispose: done },
    extensionProcessOwners: {
      dispose: async () => {
        order.push("processes");
        if (stopFails) throw processFailure;
      },
    },
    artifactMountWatch: { dispose: done },
    automationService: { close: done },
    terminalSupervisor: { dispose: done },
    closeDb: async () => {
      order.push("database");
      if (dbFails) throw databaseFailure;
    },
    closeSessionHooks: done,
    closeAccount: async () => {
      order.push("account");
    },
    stopQueueReadiness: done,
    sessionQueueLifecycle: { close: done } as never,
    harnessRegistry: { dispose: done } as never,
    extensionInstallations: { dispose: done } as never,
    nativeDocuments: { dispose: done },
    textEditing: { dispose: done },
  });
  const failure = await close().catch((error) => error);
  expect(order).toEqual(["processes", "workers", "account", "database"]);
  if (stopFails) {
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.cause).toBe(runtimeFailure);
    expect(failure.errors).toEqual([
      runtimeFailure,
      processFailure,
      workerFailure,
      ...(dbFails ? [databaseFailure] : []),
    ]);
  } else expect(failure).toBe(runtimeFailure);
});

test("a forced shutdown still stops terminals and jobs when a session's harness fails to stop", async () => {
  const cancelled: string[] = [];
  let disposed = 0;
  const deps = createRuntimeRouteDeps({
    host: {} as RuntimeHost,
    sessionService: {
      listByStatus: async (status: string) => (status === "in_progress" ? [{ id: "a" }, { id: "b" }] : []),
      cancel: async (id: string) => {
        cancelled.push(id);
        if (id === "a") throw new Error("Reply stopped the run");
      },
    } as unknown as Parameters<typeof createRuntimeRouteDeps>[0]["sessionService"],
    terminalSupervisor: { dispose: async () => void disposed++ } as unknown as Parameters<
      typeof createRuntimeRouteDeps
    >[0]["terminalSupervisor"],
    extensionScheduler: { dispose: async () => void disposed++ } as unknown as Parameters<
      typeof createRuntimeRouteDeps
    >[0]["extensionScheduler"],
  });
  await deps!.cancelActivity();
  expect(cancelled).toEqual(["a", "b"]);
  expect(disposed).toBe(2);
});
