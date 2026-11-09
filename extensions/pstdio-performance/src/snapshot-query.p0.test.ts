import { expect, test } from "bun:test";
import { createScopedQueryClient, type PerformanceSnapshot } from "@pstdio/sdk/extensions";
import { createSnapshotQuery } from "./snapshot-query";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const fixture = () => {
  const queries = createScopedQueryClient({ runtimeId: "test", extensionId: "pstdio.pstdio-performance" });
  let push: (value: PerformanceSnapshot | null) => void = () => {};
  let value: PerformanceSnapshot | null = null;
  let reads = 0;
  let subscriptions = 0;
  let disposed = 0;
  const performance = {
    snapshot: async () => {
      reads++;
      return value;
    },
    subscribe: async (listener: typeof push) => {
      subscriptions++;
      push = listener;
      return async () => {
        disposed++;
      };
    },
  };
  return {
    client: { queries, performance },
    push: (next: typeof value) => {
      value = next;
      push(next);
    },
    counts: () => ({ reads, subscriptions, disposed }),
  };
};
const sample = { version: 1, frameRate: [60] } as unknown as PerformanceSnapshot;

test("closed popovers can prepare one finite snapshot without a live measurement subscription", async () => {
  const f = fixture();
  const query = createSnapshotQuery(f.client);
  expect(await query.read()).toBeNull();
  expect(f.counts()).toEqual({ reads: 1, subscriptions: 0, disposed: 0 });
  f.client.queries.dispose();
});

test("opening reconciles a held preload captured before monitoring was disabled", async () => {
  const f = fixture();
  const preload = Promise.withResolvers<PerformanceSnapshot | null>();
  let reads = 0;
  f.client.performance.snapshot = () => (++reads === 1 ? preload.promise : Promise.resolve(null));
  const query = createSnapshotQuery(f.client);
  const prepared = query.read();
  const stop = query.subscribe(() => {});
  preload.resolve(sample);
  await prepared;
  await turn();
  expect(query.getSnapshot().data).toBeNull();
  expect(reads).toBe(2);
  stop();
  f.client.queries.dispose();
});

test("two visible performance observations share one snapshot and monitoring listener, releasing only the last lease", async () => {
  const f = fixture();
  const query = createSnapshotQuery(f.client);
  expect(query.getSnapshot().data).toBeUndefined();
  expect(f.counts()).toEqual({ reads: 0, subscriptions: 0, disposed: 0 });
  const first = query.subscribe(() => {});
  const second = createSnapshotQuery(f.client).subscribe(() => {});
  await turn();
  expect(query.getSnapshot().data).toBeNull();
  expect(f.counts()).toEqual({ reads: 1, subscriptions: 1, disposed: 0 });
  f.push(sample);
  expect(query.getSnapshot().data).toBe(sample);
  first();
  await turn();
  expect(f.counts().disposed).toBe(0);
  second();
  await turn();
  expect(f.counts().disposed).toBe(1);
  f.push(null);
  expect(query.getSnapshot().data).toBe(sample);
  const reopened = query.subscribe(() => {});
  await turn();
  expect(query.getSnapshot().data).toBeNull();
  expect(f.counts()).toEqual({ reads: 2, subscriptions: 2, disposed: 1 });
  reopened();
  f.client.queries.dispose();
});

test("a pushed performance snapshot supersedes a held initial read without adding another measurement", async () => {
  const f = fixture();
  const initial = Promise.withResolvers<PerformanceSnapshot | null>();
  f.client.performance.snapshot = () => initial.promise;
  const query = createSnapshotQuery(f.client);
  const stop = query.subscribe(() => {});
  f.push(sample);
  initial.reject(new Error("Stale initial read"));
  await turn();
  expect(query.getSnapshot().data).toBe(sample);
  expect(query.getSnapshot().error).toBeUndefined();
  stop();
  f.client.queries.dispose();
});

test("a failed performance observation preserves the latest value and recovers on the host's next push", async () => {
  const f = fixture();
  const subscription = Promise.withResolvers<() => Promise<void>>();
  const subscribe = f.client.performance.subscribe;
  f.client.performance.subscribe = (listener) => {
    void subscribe(listener);
    return subscription.promise;
  };
  const query = createSnapshotQuery(f.client);
  const stop = query.subscribe(() => {});
  await turn();
  f.push(sample);
  subscription.reject(new Error("Subscription disconnected"));
  await turn();
  expect(query.getSnapshot().data).toBe(sample);
  expect(query.getSnapshot().error?.message).toBe("Subscription disconnected");
  f.push(null);
  expect(query.getSnapshot().error).toBeUndefined();
  expect(query.getSnapshot().data).toBeNull();
  stop();
  f.client.queries.dispose();
});

test("a failed finite performance read remains distinct from monitoring off and can be retried", async () => {
  const f = fixture();
  f.client.performance.snapshot = async () => {
    throw new Error("Rejected desktop IPC");
  };
  const query = createSnapshotQuery(f.client);
  const stop = query.subscribe(() => {});
  await turn();
  expect(query.getSnapshot().data).toBeUndefined();
  expect(query.getSnapshot().error?.message).toBe("Rejected desktop IPC");
  f.client.performance.snapshot = async () => null;
  query.invalidate();
  await turn();
  expect(query.getSnapshot().data).toBeNull();
  expect(query.getSnapshot().error).toBeUndefined();
  stop();
  f.client.queries.dispose();
});

test("closing before the performance subscription starts releases it when ready and ignores its late value", async () => {
  const f = fixture();
  const starting = Promise.withResolvers<void>();
  const subscribe = f.client.performance.subscribe;
  f.client.performance.subscribe = async (listener) => {
    await starting.promise;
    return subscribe(listener);
  };
  const query = createSnapshotQuery(f.client);
  const stop = query.subscribe(() => {});
  await turn();
  stop();
  starting.resolve();
  await turn();
  f.push(sample);
  expect(query.getSnapshot().data).toBeNull();
  expect(f.counts().disposed).toBe(1);
  f.client.queries.dispose();
});
