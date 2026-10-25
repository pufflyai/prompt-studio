import { afterEach, expect, test } from "bun:test";
import { peer, sink } from "./shared-server-peer";

const peers: ReturnType<typeof peer>[] = [];
afterEach(async () => {
  for (const p of peers.splice(0)) await p.runtime.dispose();
});
const setup = () => {
  const p = peer();
  peers.push(p);
  return p;
};
const input = (id: string, project?: string) => ({
  prompt: id,
  cwd: `/tmp/${id}`,
  events: sink(),
  env: { PSTDIO_SESSION_ID: id, ...(project ? { PSTDIO_PROJECT_ID: project } : {}) },
});
test("concurrent owners share one process and route only their thread events", async () => {
  const { runtime, children, calls } = setup();
  const a = input("a", "p");
  const b = input("b", "q");
  const [first, second] = await Promise.all([runtime.run(a), runtime.run(b)]);
  expect(children).toHaveLength(1);
  expect(first.pid).toBe(second.pid);
  children[0].emit({
    method: "item/completed",
    params: {
      threadId: second.agentSessionId,
      turnId: "turn-2",
      item: { id: "b-answer", type: "agentMessage", text: "Only B" },
    },
  });
  children[0].emit({
    method: "item/completed",
    params: { item: { id: "global", type: "agentMessage", text: "No owner" } },
  });
  await first.stop();
  expect(await first.done).toEqual({ status: "cancelled" });
  children[0].emit({
    method: "turn/completed",
    params: { threadId: second.agentSessionId, turn: { id: "turn-2", status: "completed" } },
  });
  expect(await second.done).toEqual({ status: "completed" });
  expect(JSON.stringify(a.events.getMessages())).not.toContain("Only B");
  expect(JSON.stringify(b.events.getMessages())).toContain("Only B");
  expect(JSON.stringify(b.events.getMessages())).not.toContain("No owner");
  expect(calls.filter((c) => c.method === "initialize")).toHaveLength(1);
});
test("thread config owns attribution and host-only sessions omit project identity", async () => {
  const { runtime, calls, spawns } = setup();
  await runtime.run(input("a", "p"));
  await runtime.run(input("host"));
  expect(spawns).toHaveLength(1);
  expect(spawns[0]?.env?.PSTDIO_SESSION_ID).toBeUndefined();
  expect(spawns[0]?.env?.PSTDIO_PROJECT_ID).toBeUndefined();
  const starts = calls.filter((c) => c.method === "thread/start");
  expect(starts[0].params).toMatchObject({
    cwd: "/tmp/a",
    config: { "shell_environment_policy.set": { PSTDIO_SESSION_ID: "a", PSTDIO_PROJECT_ID: "p" } },
  });
  expect(starts[1].params).toMatchObject({
    cwd: "/tmp/host",
    config: {
      "shell_environment_policy.set": { PSTDIO_SESSION_ID: "host", PSTDIO_PROJECT_ID: "", USER_VALUE: "kept" },
    },
  });
});
test("retiring one project interrupts only its turn and history readers reuse the server", async () => {
  const { runtime, children, calls } = setup();
  const a = await runtime.run(input("a", "p"));
  const b = await runtime.run(input("b", "q"));
  await runtime.disposeScope("p");
  expect(await a.done).toEqual({ status: "cancelled" });
  expect(children).toHaveLength(1);
  expect(calls.filter((c) => c.method === "turn/interrupt").map((c) => c.params.threadId)).toEqual([a.agentSessionId]);
  await runtime.readMessages({ agentSessionId: "old", env: { PSTDIO_PROJECT_ID: "q" } });
  expect(children).toHaveLength(1);
  await b.stop();
  expect(await b.done).toEqual({ status: "cancelled" });
});
test("loaded native threads cannot be reassigned to another host identity", async () => {
  const { runtime, calls } = setup();
  const a = await runtime.run(input("a", "p"));
  await a.stop();
  await expect(runtime.run({ ...input("b", "q"), agentSessionId: a.agentSessionId })).rejects.toThrow(
    "different host session",
  );
  expect(calls.filter((c) => c.method === "turn/start")).toHaveLength(1);
});
test("cwd changes keep the same owner and different Codex homes remain separate", async () => {
  const { runtime, children, calls } = setup();
  const a = input("a", "p");
  const first = await runtime.run(a);
  await first.stop();
  await first.done;
  await runtime.run({ ...a, cwd: "/tmp/changed", agentSessionId: first.agentSessionId });
  expect(children).toHaveLength(1);
  expect(calls.filter((c) => c.method === "thread/start")).toHaveLength(1);
  await runtime.run({ ...input("b", "p"), env: { ...input("b", "p").env, CODEX_HOME: "/tmp/other-home" } });
  expect(children).toHaveLength(2);
});

test.each([
  "thread/start",
  "turn/start",
])("cancellation during %s waits for ownership and leaves another thread alive", async (method) => {
  const { runtime, children, calls, holdNext } = setup();
  const signal = new AbortController();
  const held = holdNext(method);
  const pending = runtime.run({ ...input("a", "p"), signal: signal.signal });
  const result = pending.catch((error) => error);
  await held.requested;
  signal.abort();
  const b = await runtime.run(input("b", "q"));
  held.reply();
  const a = await result;
  if (method === "thread/start") {
    expect(a).toBeInstanceOf(Error);
    expect(calls.filter((c) => c.method === "turn/start")).toHaveLength(1);
  } else {
    expect(await a.done).toEqual({ status: "cancelled" });
  }
  expect(children).toHaveLength(1);
  await b.stop();
  expect(await b.done).toEqual({ status: "cancelled" });
});
test("shared process loss disconnects every active owner and reconciles without replay", async () => {
  const { runtime, children, calls } = setup();
  const a = input("a", "p");
  const b = input("b", "q");
  const first = await runtime.run(a);
  const second = await runtime.run(b);
  children[0].kill();
  expect(await first.done).toEqual({ status: "disconnected" });
  expect(await second.done).toEqual({ status: "disconnected" });
  const recovered = await runtime.run({ ...a, agentSessionId: first.agentSessionId });
  expect(children).toHaveLength(2);
  expect(calls.filter((c) => c.method === "turn/start")).toHaveLength(3);
  expect(calls.filter((c) => c.method === "thread/read").map((c) => c.params.threadId)).toContain(first.agentSessionId);
  await recovered.stop();
  await recovered.done;
});

test("a turn rejected by a stale Codex login restarts the shared server for the next turn", async () => {
  const { runtime, children, calls, holdNext } = setup();
  const a = input("a", "p");
  const held = holdNext("turn/start");
  const pending = runtime.run(a);
  await held.requested;
  // The rejection can arrive before the turn/start reply.
  children[0].emit({
    method: "turn/completed",
    params: {
      threadId: "thread-1",
      turn: {
        id: "turn-1",
        status: "failed",
        error: { message: "Please sign in again.", codexErrorInfo: "unauthorized" },
      },
    },
  });
  held.reply();
  const first = await pending;
  expect(await first.done).toEqual({ status: "failed" });
  expect(JSON.stringify(a.events.getMessages())).toContain("Please sign in again.");
  const resumed = await runtime.run({ ...a, agentSessionId: first.agentSessionId });
  expect(children).toHaveLength(2);
  expect(calls.filter((c) => c.method === "thread/resume").map((c) => c.params.threadId)).toEqual([
    first.agentSessionId,
  ]);
  await resumed.stop();
  await resumed.done;
});

test("aborting a delayed goal update keeps other owners connected", async () => {
  const { runtime, children, holdNext, calls } = setup();
  const a = input("a", "p");
  const first = await runtime.run(a);
  const second = await runtime.run(input("b", "q"));
  const held = holdNext("thread/goal/set");
  const controller = new AbortController();
  const updated = runtime.prepareGoalUpdate(a)!({ objective: "goal" }, controller.signal).catch((error) => error);
  await held.requested;
  controller.abort();
  held.reply();
  expect(await updated).toBeInstanceOf(Error);
  expect(await first.done).toEqual({ status: "cancelled" });
  expect(children).toHaveLength(1);
  expect(calls.filter((c) => c.method === "thread/goal/set" && c.params.objective)).toHaveLength(1);
  await second.stop();
  expect(await second.done).toEqual({ status: "cancelled" });
});
test("lost thread creation never dispatches autonomous work and read failures never retry", async () => {
  const { runtime, children, holdNext, calls } = setup();
  const held = holdNext("thread/start");
  const pending = runtime.run(input("a")).catch((error) => error);
  await held.requested;
  children[0].kill();
  expect(await pending).toBeInstanceOf(Error);
  expect(calls.filter((c) => c.method === "turn/start" || c.method === "thread/goal/set")).toHaveLength(0);
  const read = holdNext("thread/read");
  const reading = runtime.readMessages({ agentSessionId: "old" }).catch((error) => error);
  await read.requested;
  children[1].kill();
  expect(await reading).toBeInstanceOf(Error);
  expect(calls.filter((c) => c.method === "thread/read")).toHaveLength(1);
});

test("shell allowlists preserve user entries and include host attribution", async () => {
  const { runtime, calls } = setup();
  await runtime.run(input("a", "p"));
  const config = calls.find((call) => call.method === "thread/start")!.params.config as Record<string, unknown>;
  expect(config["shell_environment_policy.include_only"]).toEqual([
    "PATH",
    "HOME",
    "USER_VALUE",
    "PSTDIO_SESSION_ID",
    "PSTDIO_PROJECT_ID",
  ]);
});
