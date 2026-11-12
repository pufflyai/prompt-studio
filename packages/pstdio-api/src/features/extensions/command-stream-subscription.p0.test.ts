import { afterEach, beforeEach, expect, test } from "bun:test";
import { prepareCommandSubscription } from "./command-stream-subscription";
import { createWorkspaceContextFixture } from "./workspace-context.test-fixture";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
});
afterEach(async () => {
  await fixture.cleanup();
});
const input = { project_id: "project-1", command_id: "example.context.command.inspect", body: {} };

test("refuses non-streaming commands before starting a subscription", async () => {
  expect(await prepareCommandSubscription(fixture.deps, input)).toMatchObject({
    status: 409,
    code: "command_not_streamable",
  });
});

test("subscription cancellation reaches the handler and closes pending writes", async () => {
  const snapshot = await fixture.deps.extensionRuntimeCatalog.get("project-1");
  const command = snapshot.runtime.commands[0]!;
  command.stream = { kind: "stream" };
  const ready = Promise.withResolvers<void>();
  let signal!: AbortSignal;
  command.run = async (ctx) => {
    signal = ctx.signal!;
    ready.resolve();
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    await ctx.stream.write("late");
  };
  const prepared = await prepareCommandSubscription(fixture.deps, input);
  if ("error" in prepared) throw new Error(prepared.error);
  let cancel = () => {};
  const events: unknown[] = [];
  const pending = prepared.run({
    aborted: false,
    onAbort: (listener) => {
      cancel = listener;
    },
    sleep: async () => {},
    write: async (event, data) => {
      events.push({ event, data });
    },
  });
  await ready.promise;
  cancel();
  await pending;
  expect(signal.aborted).toBe(true);
  expect(events).toMatchObject([{ event: "end", data: { outcome: { ok: false, code: "command_stream_cancelled" } } }]);
});

test("a handler returning after cancellation still reports a cancelled outcome", async () => {
  const snapshot = await fixture.deps.extensionRuntimeCatalog.get("project-1");
  const command = snapshot.runtime.commands[0]!;
  command.stream = { kind: "stream" };
  const ready = Promise.withResolvers<void>();
  command.run = async (ctx) => {
    ready.resolve();
    await new Promise<void>((resolve) => ctx.signal!.addEventListener("abort", () => resolve(), { once: true }));
    return "stopped";
  };
  const prepared = await prepareCommandSubscription(fixture.deps, input);
  if ("error" in prepared) throw new Error(prepared.error);
  let cancel = () => {};
  const events: unknown[] = [];
  const pending = prepared.run({
    aborted: false,
    onAbort: (listener) => {
      cancel = listener;
    },
    sleep: async () => {},
    write: async (event, data) => {
      events.push({ event, data });
    },
  });
  await ready.promise;
  cancel();
  await pending;
  expect(events).toMatchObject([{ event: "end", data: { outcome: { ok: false, code: "command_stream_cancelled" } } }]);
});

test("a historical stream command subscribes once through its canonical enabled provider", async () => {
  const legacy = await createWorkspaceContextFixture({ publisher: "pstdio", name: "pstdio-notes" });
  try {
    const snapshot = await legacy.deps.extensionRuntimeCatalog.get("project-1");
    const command = snapshot.runtime.commands.find((entry) => entry.localId === "inspect")!;
    command.stream = { kind: "stream" };
    let calls = 0;
    command.run = async (ctx) => {
      calls++;
      await ctx.stream.write("same");
    };
    const prepared = await prepareCommandSubscription(legacy.deps, {
      ...input,
      command_id: "pstdio.pstdio-notes.command.inspect",
    });
    if ("error" in prepared) throw new Error(prepared.error);
    const events: { event: string; data: unknown }[] = [];
    await prepared.run({
      aborted: false,
      onAbort() {},
      sleep: async () => {},
      write: async (event, data) => {
        events.push({ event, data });
      },
    });
    expect(calls).toBe(1);
    expect(events).toMatchObject([
      { event: "chunk", data: "same" },
      { event: "end", data: { commandId: "pstdio.notes.command.inspect", extensionId: "pstdio.notes" } },
    ]);
  } finally {
    await legacy.cleanup();
  }
});
