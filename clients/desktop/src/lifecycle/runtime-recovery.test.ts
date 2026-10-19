import { expect, test } from "bun:test";
import { createRuntimeRecovery } from "./runtime-recovery";

const setup = () => {
  let starts = 0;
  let canRestart = true;
  let start = async () => {};
  const failures: unknown[] = [];
  const recovery = createRuntimeRecovery({
    start: async () => {
      starts += 1;
      await start();
    },
    canRestart: () => canRestart,
    showFailure: async (error) => {
      failures.push(error);
    },
  });
  return {
    recovery,
    failures,
    starts: () => starts,
    setStart: (next: () => Promise<void>) => {
      start = next;
    },
    disallowRestart: () => {
      canRestart = false;
    },
  };
};

test("automatically restarts once, then waits for manual Retry after another crash", async () => {
  const s = setup();
  await s.recovery.start();
  await s.recovery.recover("first crash");
  expect(s.starts()).toBe(2);
  expect(s.failures).toEqual([]);
  await s.recovery.recover("second crash");
  expect(s.starts()).toBe(2);
  expect(s.failures).toEqual(["second crash"]);
  await s.recovery.start();
  await s.recovery.recover("third crash");
  expect(s.starts()).toBe(4);
});

test("failed automatic startup opens recovery without retrying in a loop", async () => {
  const s = setup();
  await s.recovery.start();
  const error = new Error("ownership is uncertain");
  s.setStart(async () => {
    throw error;
  });
  await s.recovery.recover("crash");
  expect(s.starts()).toBe(2);
  expect(s.failures).toEqual([error]);
});

test("Retry starts when recovery is visible and preserves the new pending startup", async () => {
  const failureShown = Promise.withResolvers<void>();
  const finishFailure = Promise.withResolvers<void>();
  const finishRetry = Promise.withResolvers<void>();
  let starts = 0;
  const recovery = createRuntimeRecovery({
    start: async () => {
      if (++starts === 1) throw new Error("ownership is uncertain");
      await finishRetry.promise;
    },
    canRestart: () => true,
    showFailure: async () => {
      failureShown.resolve();
      await finishFailure.promise;
    },
  });
  try {
    const first = recovery.start();
    await failureShown.promise;
    const retry = recovery.start();
    expect(starts).toBe(2);
    finishFailure.resolve();
    await first;
    const repeated = recovery.start();
    expect(starts).toBe(2);
    finishRetry.resolve();
    await Promise.all([retry, repeated]);
  } finally {
    finishFailure.resolve();
    finishRetry.resolve();
  }
});

test("external runtimes and quit confirmation only show recovery", async () => {
  const s = setup();
  await s.recovery.start();
  s.disallowRestart();
  await s.recovery.recover("crash");
  expect(s.starts()).toBe(1);
  expect(s.failures).toEqual(["crash"]);
});

test("a crash during workbench loading cannot be hidden by late startup completion", async () => {
  const s = setup();
  const load = Promise.withResolvers<void>();
  s.setStart(() => load.promise);
  const first = s.recovery.start();
  const repeated = s.recovery.start();
  await s.recovery.recover("crash during loading");
  expect(s.failures).toEqual(["crash during loading"]);
  load.resolve();
  await Promise.all([first, repeated]);
  expect(s.starts()).toBe(1);
  expect(s.failures.at(-1)).toBe("crash during loading");
  expect(s.failures).toHaveLength(2);
});
