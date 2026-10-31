import { expect, test } from "bun:test";
import type { PerformanceSnapshot } from "@pstdio/sdk/extensions";
import { createSnapshotStore } from "./snapshot-store";

const hostWithMonitoringOff = () => {
  let push: ((snapshot: PerformanceSnapshot | null) => void) | undefined;
  let disposed = 0;
  return {
    performance: {
      snapshot: async () => null,
      subscribe: async (listener: (snapshot: PerformanceSnapshot | null) => void) => {
        push = listener;
        return async () => {
          disposed++;
        };
      },
    },
    push: (snapshot: PerformanceSnapshot | null) => push?.(snapshot),
    disposed: () => disposed,
  };
};

test("reads null while monitoring is off, follows host snapshots and releases the host listener", async () => {
  const host = hostWithMonitoringOff();
  const store = createSnapshotStore(host.performance);
  const seen: unknown[] = [];
  const stop = store.subscribe(() => seen.push(store.get()));
  await Bun.sleep(0);
  expect(store.get()).toBeNull();

  const snapshot = { version: 1, frameRate: [60] } as unknown as PerformanceSnapshot;
  host.push(snapshot);
  expect(store.get()).toBe(snapshot);
  host.push(null);
  expect(seen).toEqual([null, snapshot, null]);

  stop();
  await Bun.sleep(0);
  expect(host.disposed()).toBe(1);
});

test("reports a failed read instead of treating it as monitoring off", async () => {
  const store = createSnapshotStore({
    snapshot: async () => {
      throw new Error("Rejected desktop IPC");
    },
    subscribe: async () => async () => {},
  });
  const stop = store.subscribe(() => {});
  await Bun.sleep(0);

  expect(store.get()).toBeNull();
  expect(store.getError()).toContain("Rejected desktop IPC");
  stop();
});

test("reports a rejected subscription and keeps the latest snapshot", async () => {
  const host = hostWithMonitoringOff();
  const subscription = Promise.withResolvers<() => Promise<void>>();
  const store = createSnapshotStore({
    snapshot: host.performance.snapshot,
    subscribe: (listener) => {
      void host.performance.subscribe(listener);
      return subscription.promise;
    },
  });
  const stop = store.subscribe(() => {});
  const snapshot = { version: 1, frameRate: [60] } as unknown as PerformanceSnapshot;
  host.push(snapshot);
  subscription.reject(new Error("Subscription disconnected"));
  await Bun.sleep(0);

  expect(store.get()).toBe(snapshot);
  expect(store.getError()).toContain("Subscription disconnected");
  host.push(null);
  expect(store.getError()).toBeUndefined();
  stop();
});

test("keeps a pushed snapshot when the initial read later fails", async () => {
  const host = hostWithMonitoringOff();
  const initial = Promise.withResolvers<PerformanceSnapshot | null>();
  const store = createSnapshotStore({
    snapshot: () => initial.promise,
    subscribe: host.performance.subscribe,
  });
  const stop = store.subscribe(() => {});
  const snapshot = { version: 1, frameRate: [60] } as unknown as PerformanceSnapshot;
  host.push(snapshot);
  initial.reject(new Error("Stale initial read"));
  await Bun.sleep(0);

  expect(store.get()).toBe(snapshot);
  expect(store.getError()).toBeUndefined();
  stop();
});
