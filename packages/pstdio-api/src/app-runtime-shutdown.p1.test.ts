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

const harnessShutdownCases: Array<
  [
    string,
    { runtimeFails?: boolean; stopFails?: boolean; dbFails?: boolean; harnessOutcome?: "rejected" | "timed_out" },
  ]
> = [
  ["the runtime stops cleanly", {}],
  ["the runtime fails to stop", { runtimeFails: true }],
  ["runtime, process, and worker cleanup fail", { runtimeFails: true, stopFails: true }],
  ["runtime, process, worker, and database cleanup fail", { runtimeFails: true, stopFails: true, dbFails: true }],
  ["harness cleanup fails", { harnessOutcome: "rejected" }],
  ["harness cleanup misses its deadline", { harnessOutcome: "timed_out" }],
];

test.each(
  harnessShutdownCases,
)("shutdown keeps backend workers available during the harness cleanup allowance when %s", async (_, options) => {
  const { runtimeFails, stopFails, dbFails, harnessOutcome } = options;
  const runtimeFailure = new Error("extension runtime did not stop");
  const processFailure = new Error("process cleanup failed");
  const harnessFailure = new Error("harness cleanup failed");
  const workerFailure = new Error("worker cleanup failed");
  const databaseFailure = new Error("database cleanup failed");
  const harnessEntered = Promise.withResolvers<void>();
  const releaseHarness = Promise.withResolvers<void>();
  const order: string[] = [];
  const done = async () => {};
  const close = createAppCloser({
    harnessShutdownGraceMs: harnessOutcome === "timed_out" ? 0 : undefined,
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
        if (runtimeFails) throw runtimeFailure;
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
    harnessRegistry: {
      dispose: async () => {
        harnessEntered.resolve();
        await releaseHarness.promise;
        order.push("harness");
        if (harnessOutcome === "rejected") throw harnessFailure;
      },
    } as never,
    extensionInstallations: { dispose: done } as never,
    nativeDocuments: { dispose: done },
    textEditing: { dispose: done },
  });
  const closing = close().catch((error) => error);
  try {
    await harnessEntered.promise;
    if (harnessOutcome === "timed_out") {
      expect(await closing).toEqual(new Error("Harness cleanup did not finish before the shutdown deadline."));
      expect(order).toEqual(["processes", "workers", "account", "database"]);
      return;
    }
    // Give synchronous cleanup and its promise continuations a turn while the harness is held.
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(order).toEqual(["processes"]);
  } finally {
    releaseHarness.resolve();
    await closing;
  }
  const failure = await closing;
  expect(order).toEqual(["processes", "harness", "workers", "account", "database"]);
  if (stopFails) {
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.cause).toBe(runtimeFailure);
    expect(failure.errors).toEqual([
      runtimeFailure,
      processFailure,
      workerFailure,
      ...(dbFails ? [databaseFailure] : []),
    ]);
  } else {
    const failureBeforeHarnesses = runtimeFails ? runtimeFailure : undefined;
    expect(failure).toBe(harnessOutcome === "rejected" ? harnessFailure : failureBeforeHarnesses);
  }
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
