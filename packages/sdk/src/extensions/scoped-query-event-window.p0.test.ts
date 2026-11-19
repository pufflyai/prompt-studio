import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { createScopedQueryClient } from "./scoped-query";

type Factory = typeof createScopedQueryClient;
let directory: string;
let candidate: Factory;
let control: Factory;
const scope = { runtimeId: "windowed", accountId: "a", projectId: "project", extensionId: "tool" };
const microtasks = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const settleWindow = () => new Promise((resolve) => setTimeout(resolve, 50));

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "pstdio-query-window-"));
  for (const milliseconds of [0, 25]) {
    const outdir = join(directory, String(milliseconds));
    const built = await Bun.build({
      entrypoints: [join(import.meta.dirname, "scoped-query.ts")],
      outdir,
      target: "browser",
      format: "esm",
      define: { __PSTDIO_QUERY_EVENT_WINDOW_MS__: String(milliseconds) },
    });
    if (!built.success) throw new AggregateError(built.logs, "Could not build the actual query owner");
    const output = built.outputs.find(({ kind }) => kind === "entry-point")!;
    const loaded = (await import(output.path)) as { createScopedQueryClient: Factory };
    if (milliseconds) candidate = loaded.createScopedQueryClient;
    else control = loaded.createScopedQueryClient;
    console.info(
      JSON.stringify({
        eventWindowMs: milliseconds,
        sha256: new Bun.CryptoHasher("sha256").update(await output.arrayBuffer()).digest("hex"),
        bytes: output.size,
      }),
    );
  }
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true });
});

test("the built owner coalesces events across microtasks without replacing its shared identity", async () => {
  for (const [factory, expectedReads] of [
    [control, 2],
    [candidate, 1],
  ] as const) {
    const root = factory(scope);
    let value = 0;
    const reads: number[] = [];
    const descriptor = {
      id: "records",
      read: async () => {
        reads.push(value);
        return value;
      },
    };
    const query = root.query(descriptor);
    const stop = query.subscribe(() => {});
    const peer = query.subscribe(() => {});
    try {
      expect(root.query(descriptor)).toBe(query);
      await query.read();
      value = 1;
      query.invalidate();
      await microtasks();
      expect(reads).toHaveLength(expectedReads);
      value = 2;
      query.invalidate();
      await settleWindow();
      // A manual reader joins and completes any background reconciliation.
      expect(await query.read()).toBe(2);
      if (factory === candidate) expect(reads).toEqual([0, 2]);
    } finally {
      stop();
      peer();
      root.dispose();
    }
  }
});

test("an explicit read bypasses the event window and consumes its pending admission", async () => {
  const root = candidate(scope);
  let value = 0;
  let reads = 0;
  const query = root.query({
    id: "required",
    read: async () => {
      reads++;
      return value;
    },
  });
  const stop = query.subscribe(() => {});
  try {
    await query.read();
    value = 1;
    query.invalidate();
    const required = query.read();
    await microtasks();
    expect(reads).toBe(2);
    expect(await required).toBe(1);
    await settleWindow();
    expect(reads).toBe(2);
  } finally {
    stop();
    root.dispose();
  }
});

test.each([
  "unsubscribe",
  "dispose",
  "authority",
  "accept",
  "cancel",
] as const)("%s retires a pending automatic admission", async (ending) => {
  const root = candidate(scope);
  let reads = 0;
  const query = root.query({ id: "retire", read: async () => ++reads });
  const stop = query.subscribe(() => {});
  try {
    await query.read();
    query.invalidate();
    if (ending === "unsubscribe") stop();
    if (ending === "dispose") root.dispose();
    if (ending === "authority") root.setAuthority({ accountId: "b" });
    if (ending === "accept") query.accept(99);
    if (ending === "cancel") query.cancel();
    await settleWindow();
    expect(reads).toBe(1);
    if (ending === "accept") expect(query.getSnapshot().data).toBe(99);
    if (ending === "authority" || ending === "dispose") expect(query.getSnapshot().data).toBeUndefined();
  } finally {
    stop();
    root.dispose();
  }
});

test("a required caller drains an invalidated slow child without publishing its stale result", async () => {
  const root = candidate(scope);
  const initial = Promise.withResolvers<number>();
  const values: number[] = [];
  let reads = 0;
  const query = root.query({ id: "slow", read: () => (++reads === 1 ? initial.promise : Promise.resolve(2)) });
  const stop = query.subscribe(() => {
    const snapshot = query.getSnapshot();
    if (!snapshot.fetching && snapshot.data !== undefined) values.push(snapshot.data);
  });
  try {
    query.invalidate();
    const required = query.read();
    initial.resolve(1);
    expect(await required).toBe(2);
    expect(query.getSnapshot().data).toBe(2);
    expect(values).not.toContain(1);
    expect(reads).toBe(2);
  } finally {
    initial.resolve(1);
    stop();
    root.dispose();
  }
});

test("a rejected accepted value preserves the pending refresh in ordinary and windowed builds", async () => {
  for (const factory of [control, candidate]) {
    const root = factory(scope);
    let value = 0;
    const query = root.query({ id: "invalid-accept", read: async () => value });
    const stop = query.subscribe(() => {});
    try {
      await query.read();
      value = 2;
      query.invalidate();
      expect(() => query.accept(undefined as never)).toThrow("must accept a value");
      await settleWindow();
      expect(query.getSnapshot().data).toBe(2);
    } finally {
      stop();
      root.dispose();
    }
  }
});

test.each([
  "value",
  "error",
] as const)("authoritative %s publication retires its timer before a reentrant invalidation", async (kind) => {
  const root = candidate(scope);
  let value = 0;
  let invalidated = false;
  const query = root.query({ id: "publication", read: async () => value });
  const stop = query.subscribe(() => {
    const snapshot = query.getSnapshot();
    if (!invalidated && (snapshot.data === 99 || snapshot.error)) {
      invalidated = true;
      query.invalidate();
    }
  });
  let armed = 0;
  const original = globalThis.setTimeout;
  const timer = spyOn(globalThis, "setTimeout").mockImplementation(
    new Proxy(original, {
      apply(target, receiver, args) {
        if (args[1] === 25) armed++;
        return Reflect.apply(target, receiver, args);
      },
    }),
  );
  try {
    await query.read();
    value = 2;
    query.invalidate();
    if (kind === "value") query.accept(99);
    else query.reportError(new Error("authoritative failure"));
    expect(invalidated).toBe(true);
    expect(armed).toBe(2);
    await settleWindow();
    expect(query.getSnapshot().data).toBe(2);
  } finally {
    timer.mockRestore();
    stop();
    root.dispose();
  }
});
