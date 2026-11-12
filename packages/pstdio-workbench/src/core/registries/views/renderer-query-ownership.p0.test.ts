import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createRendererReadRegistry } from "./renderer-read-registry";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("duplicate presentations share one progressive read, release independently, and reuse a warm snapshot", async () => {
  const queries = createScopedQueryClient({ runtimeId: "runtime", projectId: "a", extensionId: "example" });
  const registry = createRendererReadRegistry({ queries });
  const pending = Promise.withResolvers<string>();
  let calls = 0;
  let signal: AbortSignal | undefined;
  let progress: ((value: string) => void) | undefined;
  const values: string[] = [];
  const identity = { queryKey: "notes", sourceId: "notes" };
  const request = {
    ...identity,
    load: (input: AbortSignal, publish: (value: string) => void) => {
      calls++;
      signal = input;
      progress = publish;
      return pending.promise;
    },
    onValue: (value: string) => values.push(value),
    onError: () => {},
  };
  const first = registry.bind("one");
  const second = registry.bind("two");
  first.request(request);
  const loaded = second.request(request);
  await turn();
  expect(calls).toBe(1);
  first.dispose();
  expect(signal?.aborted).toBe(false);
  progress?.("partial");
  pending.resolve("loaded");
  await loaded;
  expect(values).toEqual(["loaded"]);
  expect(queries.inspect().active).toBe(1);
  second.dispose();
  expect(queries.inspect().active).toBe(0);
  expect(registry.peek<string>(identity)?.data).toBe("loaded");
  const again = registry.bind("three");
  await again.request(request);
  expect(calls).toBe(1);
  again.dispose();
  await registry.dispose();
  queries.dispose();
});

test("A to B to A reuses unchanged native data and catches up only the project marked stale while inactive", async () => {
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "example" });
  const registry = createRendererReadRegistry({ queries });
  const calls = { a: 0, b: 0 };
  const request = (projectId: "a" | "b") => ({
    queryKey: "notes",
    sourceId: "notes",
    queryEvents: ["notes.changed"],
    queryScope: { projectId },
    load: async () => `${projectId}:${++calls[projectId]}`,
    onValue: () => {},
    onError: () => {},
  });
  let binding = registry.bind("placement");
  await binding.request(request("a"));
  binding.dispose();
  binding = registry.bind("placement");
  await binding.request(request("b"));
  binding.dispose();
  binding = registry.bind("placement");
  await binding.request(request("a"));
  binding.dispose();
  expect(calls).toEqual({ a: 1, b: 1 });
  queries.invalidate({ type: "changed", id: "notes.changed", projectId: "b" });
  await turn();
  expect(calls).toEqual({ a: 1, b: 1 });
  queries.invalidate({ type: "changed", id: "notes.changed", projectId: "a" });
  expect(registry.peek<string>(request("a"))?.data).toBe("a:1");
  binding = registry.bind("placement");
  await binding.request(request("a"));
  expect(calls).toEqual({ a: 2, b: 1 });
  binding.dispose();
  await registry.dispose();
  queries.dispose();
});

test("changing query identity aborts its source but keeps the placement barrier until the child settles", async () => {
  const registry = createRendererReadRegistry();
  const binding = registry.bind("placement");
  const pending = Promise.withResolvers<string>();
  let signal: AbortSignal | undefined;
  let nextCalls = 0;
  binding.request({
    queryKey: "old",
    load: (input) => {
      signal = input;
      return pending.promise;
    },
    onValue: () => {},
    onError: () => {},
  });
  await turn();
  const next = binding.request({
    queryKey: "new",
    load: async () => {
      nextCalls++;
      return "new";
    },
    onValue: () => {},
    onError: () => {},
  });
  await turn();
  expect(signal?.aborted).toBe(true);
  expect(nextCalls).toBe(0);
  pending.resolve("old");
  await next;
  expect(nextCalls).toBe(1);
  binding.dispose();
  await registry.dispose();
});

test("the same raw key in another project aborts a cooperative source before admitting its replacement", async () => {
  const registry = createRendererReadRegistry();
  const binding = registry.bind("placement");
  let aborted = false;
  const values: string[] = [];
  binding.request({
    queryKey: "notes",
    queryScope: { projectId: "a" },
    load: (signal) =>
      new Promise<string>((resolve) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            resolve("old");
          },
          { once: true },
        );
      }),
    onValue: (value) => values.push(value),
    onError: () => {},
  });
  await turn();
  await binding.request({
    queryKey: "notes",
    queryScope: { projectId: "b" },
    load: async () => "new",
    onValue: (value) => values.push(value),
    onError: () => {},
  });
  expect(aborted).toBe(true);
  expect(values).toEqual(["new"]);
  binding.dispose();
  await registry.dispose();
});

test("a late duplicate receives current progress and both settled views observe a single refreshed result", async () => {
  const registry = createRendererReadRegistry();
  const pending = Promise.withResolvers<string>();
  let calls = 0;
  let publish: ((value: string) => void) | undefined;
  const values = { first: [] as string[], second: [] as string[] };
  const progress: string[] = [];
  const request = (name: keyof typeof values) => ({
    queryKey: "notes",
    sourceId: "notes",
    load: (_signal: AbortSignal, next: (value: string) => void) => {
      publish = next;
      return ++calls === 1 ? pending.promise : Promise.resolve("new");
    },
    onProgress: (value: string) => progress.push(`${name}:${value}`),
    onValue: (value: string) => values[name].push(value),
    onError: () => {},
  });
  const first = registry.bind("first");
  const initial = first.request(request("first"));
  await turn();
  publish?.("static controls");
  const second = registry.bind("second");
  const duplicate = second.request(request("second"));
  await turn();
  expect(progress).toEqual(["first:static controls", "second:static controls"]);
  expect(calls).toBe(1);
  pending.resolve("old");
  await Promise.all([initial, duplicate]);
  await first.request(request("first"));
  expect(calls).toBe(2);
  expect(values).toEqual({ first: ["old", "new"], second: ["old", "new"] });
  const saved = registry.holdForMutation({ queryKey: "notes", sourceId: "notes" });
  first.dispose();
  second.dispose();
  // A save acknowledged after both views leave must retire the retained pre-save snapshot.
  saved();
  await turn();
  expect(calls).toBe(2);
  const returned = registry.bind("returned");
  await returned.request(request("first"));
  expect(calls).toBe(3);
  returned.dispose();
  await registry.dispose();
});

test("a shared refresh failure reaches both settled presentations once while retaining loaded data", async () => {
  const registry = createRendererReadRegistry();
  const first = registry.bind("first");
  const second = registry.bind("second");
  let failed = false;
  const errors = { first: [] as unknown[], second: [] as unknown[] };
  const request = (name: keyof typeof errors) => ({
    queryKey: "notes",
    load: async () => {
      if (failed) throw new Error("refresh failed");
      return "old";
    },
    onValue: () => {},
    onError: (error: unknown) => errors[name].push(error),
  });
  await Promise.all([first.request(request("first")), second.request(request("second"))]);
  failed = true;
  await first.request(request("first"));
  expect(errors.first).toHaveLength(1);
  expect(errors.second).toEqual(errors.first);
  expect(registry.peek<string>({ queryKey: "notes" })?.data).toBe("old");
  const recovered: string[] = [];
  const stop = registry.bind("recovering");
  await stop.request({ ...request("second"), onValue: (value) => recovered.push(value) });
  failed = false;
  await first.request(request("first"), "retry");
  expect(recovered).toEqual(["old"]);
  stop.dispose();
  first.dispose();
  second.dispose();
  await registry.dispose();
});

test("a retiring placement drains its joined child without waiting for a peer's later refresh", async () => {
  const registry = createRendererReadRegistry();
  const first = registry.bind("first");
  const peer = registry.bind("peer");
  const original = Promise.withResolvers<string>();
  const trailing = Promise.withResolvers<string>();
  let aReads = 0;
  let bReads = 0;
  const a = {
    queryKey: "a",
    load: () => (++aReads === 1 ? original.promise : trailing.promise),
    onValue: () => {},
    onError: () => {},
  };
  first.request(a);
  const peerRead = peer.request(a);
  await turn();
  const moved = first.request({
    queryKey: "b",
    load: async () => {
      bReads++;
      return "b";
    },
    onValue: () => {},
    onError: () => {},
  });
  const refreshed = peer.request(a);
  await turn();
  expect(bReads).toBe(0);
  original.resolve("old a");
  await turn();
  expect(aReads).toBe(2);
  expect(bReads).toBe(1);
  trailing.resolve("new a");
  await Promise.all([moved, peerRead, refreshed]);
  first.dispose();
  peer.dispose();
  await registry.dispose();
});

test.each([
  false,
  true,
])("pending saves retain query ownership across eviction and respect authority retirement (retired: %s)", async (retired) => {
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "notes" }, { maxInactive: 0 });
  const registry = createRendererReadRegistry({ queries });
  let server = "before";
  let calls = 0;
  const values: string[] = [];
  const request = {
    queryKey: "notes",
    sourceId: "notes",
    load: async () => {
      calls++;
      return server;
    },
    onValue: (value: string) => values.push(value),
    onError: () => {},
  };
  const first = registry.bind("first");
  await first.request(request);
  const finishSave = registry.holdForMutation(request);
  first.dispose();
  expect(queries.inspect().active).toBe(1);
  if (retired) queries.setAuthority({ accountId: "different" });
  const next = registry.bind("next");
  const returned = next.request(request);
  await turn();
  const beforeSave = calls;
  server = "after";
  finishSave();
  await returned;
  await turn();
  expect(calls).toBe(beforeSave + (retired ? 0 : 1));
  expect(values.at(-1)).toBe(retired ? "before" : "after");
  next.dispose();
  await registry.dispose();
  queries.dispose();
});
