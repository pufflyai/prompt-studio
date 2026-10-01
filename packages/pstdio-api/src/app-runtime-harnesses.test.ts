import { expect, test } from "bun:test";
import { createTestHarnessRecord, createTestHarnessRegistry } from "./features/harnesses/test-harness-registry";
import { createTestApp } from "./test-utils/create-test-app";

test("host shutdown awaits persistent harness worker cleanup once", async () => {
  let cleanupCount = 0;
  let finishCleanup: () => void = () => {};
  const cleanup = new Promise<void>((resolve) => {
    finishCleanup = resolve;
  });
  const harness = createTestHarnessRecord("worker", {
    provider: {
      dispose: async () => {
        cleanupCount += 1;
        await cleanup;
      },
    },
  });
  const app = await createTestApp({ harnessRegistry: createTestHarnessRegistry([harness]) });
  await (await app.deps.harnessRegistry.get(harness.id))!.capabilities({ projectId: "p1" });
  let finished = false;
  const closing = app.close().then(() => {
    finished = true;
  });
  await Bun.sleep(20);
  expect(finished).toBe(false);
  finishCleanup();
  await Promise.all([closing, app.close()]);
  expect(cleanupCount).toBe(1);
});

test("host shutdown can dispose a worker while queued startup is pending", async () => {
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const disposed = Promise.withResolvers<void>();
  const harness = createTestHarnessRecord("worker", {
    provider: {
      start: async () => {
        entered.resolve();
        await released.promise;
        return { done: Promise.resolve({ status: "cancelled" }), stop: () => {} };
      },
      dispose: () => {
        disposed.resolve();
        released.resolve();
      },
    },
  });
  const app = await createTestApp({ harnessRegistry: createTestHarnessRegistry([harness]) });
  const handle = (await app.deps.harnessRegistry.get(harness.id))!;
  const pending = app.deps.sessionQueueLifecycle.run(async () => {
    await handle.start({ sessionId: "s1", prompt: "hello", events: { push: () => {}, getMessages: () => [] } });
  });
  await entered.promise;
  const closing = app.close();
  try {
    const cleanupStarted = await Promise.race([disposed.promise.then(() => true), Bun.sleep(100).then(() => false)]);
    expect(cleanupStarted).toBe(true);
  } finally {
    released.resolve();
    await pending;
    await closing;
  }
});
