import { expect, test } from "bun:test";
import { createRecoveryScheduler, type RecoveryScanReason } from "./schedule";

const until = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 200 && !condition(); attempt++) await Bun.sleep(5);
  expect(condition()).toBe(true);
};
const watcher = () => {
  const handles: { changed: () => void; lost: () => void; closed: boolean }[] = [];
  return {
    handles,
    watch: (changed: () => void, lost: () => void) => {
      const handle = { changed, lost, closed: false };
      handles.push(handle);
      return {
        close: () => {
          handle.closed = true;
        },
      };
    },
  };
};

test("startup scans at once, coalesces change hints after the current scan, and rescans after watcher loss", async () => {
  const runs: RecoveryScanReason[][] = [];
  const gate = Promise.withResolvers<void>();
  const watch = watcher();
  const scheduler = createRecoveryScheduler({
    watch: watch.watch,
    quietMs: 20,
    gapMs: 0,
    retryMs: 10,
    run: async (reasons) => {
      runs.push(reasons);
      if (runs.length === 1) await gate.promise;
    },
  });
  try {
    scheduler.request("startup");
    await until(() => runs.length === 1);
    expect(runs[0]).toEqual(["startup"]);
    expect(watch.handles).toHaveLength(1);
    for (let index = 0; index < 5; index++) watch.handles[0]!.changed();
    expect(scheduler.status()).toMatchObject({ running: true, pending: true });
    gate.resolve();
    await until(() => runs.length === 2);
    expect(runs[1]).toEqual(["change"]);
    await Bun.sleep(40);
    expect(runs).toHaveLength(2);
    watch.handles[0]!.lost();
    await until(() => runs.length === 3);
    expect(runs[2]).toEqual(["watcher-lost"]);
    expect(watch.handles[0]!.closed).toBe(true);
    expect(watch.handles).toHaveLength(2);
    await until(() => !scheduler.status().pending && !scheduler.status().running);
  } finally {
    await scheduler.close();
  }
  expect(watch.handles.every((handle) => handle.closed)).toBe(true);
});

test("a failed scan keeps its work pending and retries, while close cancels a running scan", async () => {
  let attempts = 0;
  const cancelled = Promise.withResolvers<void>();
  const scheduler = createRecoveryScheduler({
    watch: watcher().watch,
    quietMs: 5,
    gapMs: 0,
    retryMs: 10,
    run: async (reasons, signal) => {
      attempts++;
      if (attempts === 1) throw new Error("Included entry unreadable");
      if (attempts === 2) expect(reasons).toEqual(["reconnect"]);
      if (attempts === 3) {
        expect(reasons).toEqual(["explicit"]);
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => {
            cancelled.resolve();
            resolve();
          }),
        );
      }
    },
  });
  scheduler.request("reconnect");
  await until(() => attempts === 1);
  expect(scheduler.status()).toMatchObject({ pending: true, failed: true });
  await until(() => attempts === 2 && !scheduler.status().running);
  expect(scheduler.status()).toMatchObject({ pending: false, failed: false });
  scheduler.request("explicit");
  await until(() => attempts === 3);
  await scheduler.close();
  await cancelled.promise;
});

test("a watcher that keeps failing rescans no more often than the change gap", async () => {
  const runs: number[] = [];
  const watch = watcher();
  const scheduler = createRecoveryScheduler({
    watch: watch.watch,
    quietMs: 5,
    gapMs: 200,
    retryMs: 10,
    run: async () => {
      runs.push(Date.now());
      watch.handles.at(-1)!.lost();
    },
  });
  try {
    scheduler.request("startup");
    await until(() => runs.length === 2);
    expect(runs[1]! - runs[0]!).toBeGreaterThanOrEqual(190);
  } finally {
    await scheduler.close();
  }
});
