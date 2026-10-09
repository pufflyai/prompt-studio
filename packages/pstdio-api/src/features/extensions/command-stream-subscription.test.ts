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
