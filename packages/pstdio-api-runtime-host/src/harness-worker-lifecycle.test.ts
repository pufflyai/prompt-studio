import { expect, test } from "bun:test";
import type { HarnessContext, HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createHarnessRegistry } from "./harness-registry";

const context = (projectId?: string) => ({ projectId, extensionId: "test.worker", name: "worker" }) as HarnessContext;

const record = (provider: Partial<HarnessProvider>): RuntimeHarnessRecord => ({
  id: "test.worker.harness.worker",
  localId: "worker",
  extensionId: "test.worker",
  name: "worker",
  sourcePath: "/extensions/worker/extension.ts",
  provider: {
    id: "worker",
    ref: { kind: "harness", id: "worker" },
    label: "Worker",
    capabilities: () => [],
    start: () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} }),
    resume: () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} }),
    ...provider,
  },
});

test("completed turns keep workers until the registry releases their project contexts", async () => {
  const released: Array<string | undefined> = [];
  const registry = createHarnessRegistry(
    [record({ dispose: (ctx) => void released.push(ctx.projectId) })],
    (_record, options) => context(options?.projectId),
  );
  const handle = registry.list()[0];
  const input = { sessionId: "s1", prompt: "hello", events: { push: () => {}, getMessages: () => [] } };
  const run = await handle.start(input, { projectId: "p1" });
  await run.done;
  await handle.resume({ ...input, agentSessionId: "native" }, { projectId: "p1" });
  await handle.start({ ...input, sessionId: "s2" }, { projectId: "p2" });
  expect(released).toEqual([]);

  await Promise.all([registry.dispose(), registry.dispose()]);
  expect(released.sort()).toEqual(["p1", "p2"]);
  await expect(handle.start(input, { projectId: "p1" })).rejects.toThrow("disposed");
});

test("disposal waits for cleanup and releases every provider after a cleanup failure", async () => {
  const released: string[] = [];
  const registry = createHarnessRegistry(
    [
      record({
        dispose: async () => {
          released.push("failed");
          throw new Error("worker cleanup failed");
        },
      }),
      { ...record({ dispose: () => void released.push("healthy") }), id: "test.worker.harness.other" },
    ],
    () => context("p1"),
  );
  await Promise.all(registry.list().map((handle) => handle.capabilities()));
  await expect(registry.dispose()).rejects.toThrow("cleanup");
  expect(released.sort()).toEqual(["failed", "healthy"]);
});

test("disposal includes a context still being built and blocks provider startup afterward", async () => {
  let provideContext: (ctx: HarnessContext) => void = () => {};
  const pending = new Promise<HarnessContext>((resolve) => {
    provideContext = resolve;
  });
  let starts = 0;
  let releases = 0;
  const registry = createHarnessRegistry(
    [
      record({
        start: () => {
          starts += 1;
          throw new Error("unexpected startup");
        },
        dispose: () => {
          releases += 1;
        },
      }),
    ],
    () => pending,
  );
  const starting = registry.list()[0].start({
    sessionId: "s1",
    prompt: "hello",
    events: { push: () => {}, getMessages: () => [] },
  });
  await Promise.resolve();
  const closing = registry.dispose();
  provideContext(context("p1"));
  await expect(starting).rejects.toThrow("disposed");
  await closing;
  expect(starts).toBe(0);
  expect(releases).toBe(1);
});

test("cleanup awaits real persistent worker exit after its turn is complete", async () => {
  let child: ReturnType<typeof Bun.spawn> | undefined;
  const registry = createHarnessRegistry(
    [
      record({
        start: () => {
          child = Bun.spawn([process.execPath, "-e", "process.stdin.resume()"], {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "ignore",
          });
          return { done: Promise.resolve({ status: "completed" }), stop: () => {} };
        },
        dispose: async () => {
          child?.kill();
          await child?.exited;
        },
      }),
    ],
    () => context("p1"),
  );
  try {
    const run = await registry
      .list()[0]
      .start({ sessionId: "s1", prompt: "hello", events: { push: () => {}, getMessages: () => [] } });
    await run.done;
    expect(child?.exitCode).toBeNull();
    await registry.dispose();
    expect(child?.signalCode).toBe("SIGTERM");
  } finally {
    child?.kill();
    await child?.exited;
  }
});
