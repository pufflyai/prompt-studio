import { expect, test } from "bun:test";
import { createWebviewClient, type GuestHost, type PerformanceSnapshot } from "@pstdio/sdk/extensions";
import { createExtensionWebviewHostCapabilities, createWebviewServiceQueryAdapter } from "@pstdio/workbench/extensions";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createPerformanceHost } from "./performance-host";
import { createPerformanceMonitoringController } from "./performance-monitoring-controller";
import { createPerformanceDiagnosticsAdapter } from "./performance-service";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const fixture = async () => {
  const storage = new Map<string, string>();
  const base = createPerformanceHost(undefined, {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
    removeItem: (key) => {
      storage.delete(key);
    },
  });
  const replies: (() => Promise<PerformanceSnapshot | null>)[] = [];
  let reads = 0,
    live = 0,
    maxLive = 0;
  const controller = createPerformanceMonitoringController({
    ...base,
    snapshot: async () => {
      reads++;
      live++;
      maxLive = Math.max(maxLive, live);
      try {
        return await (replies.shift()?.() ?? base.snapshot());
      } finally {
        live--;
      }
    },
  });
  await controller.setEnabled(true);
  const diagnostics = createPerformanceDiagnosticsAdapter(controller);
  const frames = new Set<ReturnType<typeof frame>>();
  const frame = (observeReply?: Promise<void>) => {
    const observed = Promise.withResolvers<void>();
    const events = createHostEventPublisher();
    const listeners = new Map<string, Set<(value: unknown) => void>>();
    let closed = false;
    const adapter = createWebviewServiceQueryAdapter({
      channel: "performance.query",
      owner: "window-controller",
      events,
      requireCurrent() {
        if (closed) throw new Error("frame closed");
      },
      sources: () => [{ source: { service: "snapshot" as const }, query: controller.snapshotQuery }],
      source: () => controller.snapshotQuery,
    });
    const capabilities = createExtensionWebviewHostCapabilities({
      hostEvents: events,
      performance: diagnostics,
      performanceQueries: adapter,
    });
    const host = {
      extensionId: "pstdio.pstdio-performance",
      propsStore: { get: () => ({ serviceQueries: { performance: adapter.seeds() } }), subscribe: () => () => {} },
      onEvent(scope: string, listener: (value: unknown) => void) {
        const group = listeners.get(scope) ?? new Set();
        listeners.set(scope, group);
        group.add(listener);
        return () => {
          group.delete(listener);
        };
      },
      async call(method: keyof typeof capabilities, request: never) {
        const result = await capabilities[method](request);
        const query = (request as { query?: { operation?: string } }).query;
        if (query?.operation === "observe" && observeReply) {
          observed.resolve();
          await observeReply;
        }
        return result;
      },
    } as unknown as GuestHost;
    events.bind((event) => {
      for (const listener of [...(listeners.get(event.scope) ?? [])]) listener(event.payload);
    });
    const client = createWebviewClient(host);
    const result = {
      client,
      observed: observed.promise,
      query: client.performance.query(),
      dispose() {
        closed = true;
        client.queries.dispose();
        events.unbind();
        frames.delete(result);
      },
    };
    frames.add(result);
    return result;
  };
  return {
    controller,
    frame,
    counts: () => ({ reads, live, maxLive }),
    hold() {
      const entered = Promise.withResolvers<void>(),
        pending = Promise.withResolvers<PerformanceSnapshot | null>();
      replies.push(() => {
        entered.resolve();
        return pending.promise;
      });
      return { ...pending, entered: entered.promise };
    },
    fail() {
      replies.push(async () => {
        throw new Error("Rejected desktop IPC");
      });
    },
    async dispose() {
      for (const frame of [...frames]) frame.dispose();
      controller.dispose();
    },
  };
};

test("a recreated performance view paints retained content before its held sampling catch-up and shares the host cadence", async () => {
  const f = await fixture();
  let held: ReturnType<typeof f.hold> | undefined;
  let stop = () => {};
  try {
    const old = f.frame();
    const accepted = await old.query.read();
    old.dispose();
    expect(f.controller.snapshotQuery.active()).toBe(false);
    held = f.hold();
    const returning = f.frame();
    expect(returning.query.getSnapshot().data).toEqual(accepted);
    stop = returning.query.subscribe(() => {});
    await held.entered;
    expect(returning.query.getSnapshot().data).toEqual(accepted);
    expect(returning.query.getSnapshot().fetching).toBe(true);
    expect(f.counts().reads).toBe(2);
    held.resolve(null);
    expect(await returning.query.read()).toBeNull();
    expect(f.counts().maxLive).toBe(1);
  } finally {
    held?.resolve(null);
    stop();
    await f.dispose();
  }
});

test("two Performance frames share one actual measurement and release optional observation after the last view", async () => {
  const f = await fixture();
  let held: ReturnType<typeof f.hold> | undefined;
  let a = () => {},
    b = () => {};
  try {
    held = f.hold();
    const first = f.frame(),
      second = f.frame();
    a = first.query.subscribe(() => {});
    b = second.query.subscribe(() => {});
    await held.entered;
    expect(f.counts().reads).toBe(1);
    expect(f.controller.snapshotQuery.inspect().automaticObservers).toBe(1);
    held.resolve(null);
    await first.query.read();
    a();
    expect(f.controller.snapshotQuery.active()).toBe(true);
    b();
    expect(f.controller.snapshotQuery.inspect().automaticObservers).toBe(0);
  } finally {
    held?.resolve(null);
    a();
    b();
    await f.dispose();
  }
});

test("monitoring disable supersedes a held sample and a late rejection cannot replace the accepted off state", async () => {
  const f = await fixture();
  let held: ReturnType<typeof f.hold> | undefined;
  let stop = () => {};
  try {
    const frame = f.frame();
    await frame.query.read();
    held = f.hold();
    stop = frame.query.subscribe(() => {});
    await held.entered;
    await f.controller.setEnabled(false);
    expect(frame.query.getSnapshot().data).toBeNull();
    held.reject(new Error("obsolete IPC"));
    await turn();
    expect(frame.query.getSnapshot().data).toBeNull();
    expect(frame.query.getSnapshot().error).toBeUndefined();
    expect(f.counts().maxLive).toBe(1);
  } finally {
    held?.resolve(null);
    stop();
    await f.dispose();
  }
});

test("a failed performance refresh retains accepted data and explicit retry recovers without another owner", async () => {
  const f = await fixture();
  let stop = () => {};
  try {
    const frame = f.frame();
    stop = frame.query.subscribe(() => {});
    const accepted = await frame.query.read();
    f.fail();
    await expect(frame.query.refresh()).rejects.toThrow("Rejected desktop IPC");
    expect(frame.query.getSnapshot().data).toEqual(accepted);
    expect(frame.query.getSnapshot().error?.message).toBe("Rejected desktop IPC");
    await frame.query.refresh();
    expect(frame.query.getSnapshot().error).toBeUndefined();
    expect(f.counts().maxLive).toBe(1);
  } finally {
    stop();
    await f.dispose();
  }
});

test("an initial Performance IPC failure stays distinct from monitoring off and Retry restores sampling", async () => {
  const f = await fixture();
  try {
    f.fail();
    const frame = f.frame();
    await expect(frame.query.read()).rejects.toThrow("Rejected desktop IPC");
    expect(frame.query.getSnapshot().data).toBeUndefined();
    expect(frame.query.getSnapshot().error?.message).toBe("Rejected desktop IPC");
    expect(await frame.query.refresh()).not.toBeNull();
    expect(frame.query.getSnapshot().error).toBeUndefined();
    expect(f.counts().maxLive).toBe(1);
  } finally {
    await f.dispose();
  }
});

test("closing Performance during a delayed observation acknowledgement releases the actual optional source and ignores its late reply", async () => {
  const f = await fixture(),
    bridge = Promise.withResolvers<void>();
  const sample = f.hold();
  let stop = () => {};
  try {
    const frame = f.frame(bridge.promise);
    stop = frame.query.subscribe(() => {});
    await Promise.all([frame.observed, sample.entered]);
    stop();
    await turn();
    expect(f.controller.snapshotQuery.inspect().automaticObservers).toBe(0);
    sample.resolve(null);
    await turn();
    bridge.resolve();
    await turn();
    expect(frame.query.getSnapshot().data).toBeUndefined();
    expect(f.counts().reads).toBe(1);
    expect(f.counts().maxLive).toBe(1);
  } finally {
    sample.resolve(null);
    bridge.resolve();
    stop();
    await f.dispose();
  }
});

test("legacy Performance subscriptions and snapshot reads share the controller with retained service guests", async () => {
  const f = await fixture();
  let stop = () => {},
    stopLegacy: (() => Promise<void>) | undefined;
  const delivered: (PerformanceSnapshot | null)[] = [];
  let held: ReturnType<typeof f.hold> | undefined;
  try {
    const legacy = f.frame(),
      retained = f.frame();
    stopLegacy = await legacy.client.performance.subscribe((value) => delivered.push(value));
    stop = retained.query.subscribe(() => {});
    const accepted = await retained.query.read();
    expect(f.counts().reads).toBe(1);
    expect(delivered.at(-1)).toEqual(accepted);
    held = f.hold();
    const snapshot = legacy.client.performance.snapshot();
    await held.entered;
    const joined = retained.query.read();
    held.resolve(accepted);
    expect(await snapshot).toEqual(accepted);
    expect(await joined).toEqual(accepted);
    expect(f.counts().reads).toBe(2);
    await stopLegacy();
    stopLegacy = undefined;
    legacy.dispose();
    expect(f.controller.snapshotQuery.inspect().automaticObservers).toBe(1);
    expect(f.counts().maxLive).toBe(1);
    stop();
    expect(f.controller.snapshotQuery.inspect().automaticObservers).toBe(0);
  } finally {
    held?.resolve(null);
    stop();
    await stopLegacy?.();
    await f.dispose();
  }
});
