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
test("provider shutdown settles an unanswered turn acknowledgement", async () => {
  const { runtime, holdNext } = setup();
  const held = holdNext("turn/start");
  const pending = runtime.run(input("a")).catch((error) => error);
  await held.requested;
  await runtime.dispose();
  const result = await pending;
  expect(await result.done).toEqual({ status: "cancelled" });
});
test("warm controls validate thread ownership before sending mutations", async () => {
  const { runtime, calls } = setup();
  const a = input("a");
  const b = input("b");
  const first = await runtime.run(a);
  const second = await runtime.run(b);
  await expect(runtime.worker(a).request("thread/goal/clear", { threadId: second.agentSessionId })).rejects.toThrow(
    "different thread",
  );
  expect(calls.some((call) => call.method === "thread/goal/clear")).toBe(false);
  await first.stop();
  await second.stop();
});
test("scope retirement prevents a control dispatch after delayed thread load", async () => {
  const { runtime, holdNext, calls } = setup();
  const other = await runtime.run(input("b", "q"));
  const held = holdNext("thread/resume");
  const request = runtime
    .worker(input("a", "p"))
    .request("thread/goal/set", { threadId: "old", objective: "late" })
    .catch((error) => error);
  await held.requested;
  const disposed = runtime.disposeScope("p");
  held.reply();
  await disposed;
  expect(await request).toBeInstanceOf(Error);
  expect(calls.some((call) => call.method === "thread/goal/set" && call.params.objective === "late")).toBe(false);
  await other.stop();
});
test("retiring a history reader cancels only its scope", async () => {
  const { runtime, holdNext } = setup();
  const other = await runtime.run(input("b", "q"));
  const held = holdNext("thread/read");
  const reading = runtime
    .readMessages({ agentSessionId: "old", env: { PSTDIO_PROJECT_ID: "p" } })
    .catch((error) => error);
  await held.requested;
  await runtime.disposeScope("p");
  expect(await reading).toBeInstanceOf(Error);
  await other.stop();
  expect(await other.done).toEqual({ status: "cancelled" });
});
test.each([
  "thread/goal/set",
  "thread/compact/start",
])("a turn starting before %s acknowledgement stays owned during retirement", async (method) => {
  const { runtime, children, holdNext, calls } = setup();
  const other = await runtime.run(input("b", "q"));
  const held = holdNext(method);
  const pending = runtime.run(input("a", "p"), {
    method,
    params: { objective: "task" },
    goal: method === "thread/goal/set",
  });
  await held.requested;
  children[0].emit({
    method: "turn/started",
    params: { threadId: "thread-2", turn: { id: "early", status: "inProgress" } },
  });
  held.reply();
  const operation = await pending;
  await runtime.disposeScope("p");
  expect(calls.some((call) => call.method === "turn/interrupt" && call.params.turnId === "early")).toBe(true);
  expect(await operation.done).toEqual({ status: "cancelled" });
  await other.stop();
});

test("late acknowledgement cannot resurrect a completed native turn", async () => {
  const { runtime, children, holdNext, calls } = setup();
  const held = holdNext("turn/start");
  const pending = runtime.run(input("a", "p"));
  await held.requested;
  children[0].emit({
    method: "turn/started",
    params: { threadId: "thread-1", turn: { id: "turn-1", status: "inProgress" } },
  });
  children[0].emit({
    method: "turn/completed",
    params: { threadId: "thread-1", turn: { id: "turn-1", status: "completed" } },
  });
  held.reply();
  const operation = await pending;
  expect(await operation.done).toEqual({ status: "completed" });
  await runtime.disposeScope("p");
  expect(calls.some((call) => call.method === "turn/interrupt")).toBe(false);
});

test("a failed event sink stops only its native thread", async () => {
  const { runtime, children } = setup();
  const a = input("a", "p");
  const first = await runtime.run(a);
  const second = await runtime.run(input("b", "q"));
  a.events.push = () => {
    throw new Error("Storage unavailable");
  };
  children[0].emit({
    method: "item/completed",
    params: {
      threadId: first.agentSessionId,
      turnId: "turn-1",
      item: { id: "answer", type: "agentMessage", text: "Answer" },
    },
  });
  expect(await first.done).toEqual({ status: "failed" });
  children[0].emit({
    method: "turn/completed",
    params: { threadId: second.agentSessionId, turn: { id: "turn-2", status: "completed" } },
  });
  expect(await second.done).toEqual({ status: "completed" });
});

test("warm controls reconcile uncertain native execution before another mutation", async () => {
  const p = peer({ recoveryActive: true });
  peers.push(p);
  const a = input("a");
  const run = await p.runtime.run(a);
  const held = p.holdNext("thread/goal/set");
  const controller = new AbortController();
  const updated = p.runtime.prepareGoalUpdate(a)!({ objective: "goal" }, controller.signal).catch((error) => error);
  await held.requested;
  controller.abort();
  held.reply();
  await updated;
  await run.done;
  await expect(p.runtime.worker(a).request("thread/goal/clear", { threadId: run.agentSessionId })).rejects.toThrow(
    "still in progress",
  );
  expect(p.calls.some((call) => call.method === "thread/goal/clear")).toBe(false);
});

test.each([
  false,
  true,
])("retirement reconciles interruption rejection against native running state %s", async (recoveryActive) => {
  const p = peer({ rejectInterrupt: true, recoveryActive });
  peers.push(p);
  const a = await p.runtime.run(input("a", "p"));
  const b = await p.runtime.run(input("b", "q"));
  const retirement = p.runtime.disposeScope("p");
  if (recoveryActive) await expect(retirement).rejects.toThrow("no active turn");
  else await retirement;
  expect(p.calls.some((call) => call.method === "thread/read" && call.params.threadId === a.agentSessionId)).toBe(true);
  expect(
    p.calls.some((call) => call.method === "thread/unsubscribe" && call.params.threadId === a.agentSessionId),
  ).toBe(!recoveryActive);
  p.children[0].emit({
    method: "turn/completed",
    params: { threadId: b.agentSessionId, turn: { id: "turn-2", status: "completed" } },
  });
  expect(await b.done).toEqual({ status: "completed" });
});

test("protocol cleanup completes before another operation can use its thread", async () => {
  const { runtime, children, holdNext, calls } = setup();
  const a = input("a");
  const first = await runtime.run(a);
  const held = holdNext("thread/goal/get");
  a.events.push = () => {
    throw new Error("Storage unavailable");
  };
  children[0].emit({
    method: "item/completed",
    params: {
      threadId: first.agentSessionId,
      turnId: "turn-1",
      item: { id: "answer", type: "agentMessage", text: "Answer" },
    },
  });
  await held.requested;
  expect(await first.done).toEqual({ status: "failed" });
  children[0].emit({
    method: "turn/completed",
    params: { threadId: first.agentSessionId, turn: { id: "turn-1", status: "completed" } },
  });
  const next = runtime.run({ ...a, events: sink(), agentSessionId: first.agentSessionId });
  await Bun.sleep(1);
  expect(calls.filter((call) => call.method === "turn/start")).toHaveLength(1);
  held.reply();
  const second = await next;
  expect(calls.some((call) => call.method === "turn/interrupt" && call.params.turnId === "turn-2")).toBe(false);
  await second.stop();
  expect(await second.done).toEqual({ status: "cancelled" });
});

test.each([false, true])("cancellation waits for native turn start after acknowledgement (scope=%s)", async (scope) => {
  const p = peer({ delayTurnStarted: true });
  peers.push(p);
  const a = await p.runtime.run(input("a", "p"));
  const b = await p.runtime.run(input("b", "q"));
  const stopped = scope ? p.runtime.disposeScope("p") : a.stop();
  await Bun.sleep(1);
  expect(p.calls.some((call) => call.method === "turn/interrupt")).toBe(false);
  p.children[0].emit({
    method: "turn/started",
    params: { threadId: a.agentSessionId, turn: { id: "turn-1", status: "inProgress" } },
  });
  await stopped;
  expect(await a.done).toEqual({ status: "cancelled" });
  p.children[0].emit({
    method: "turn/completed",
    params: { threadId: b.agentSessionId, turn: { id: "turn-2", status: "completed" } },
  });
  expect(await b.done).toEqual({ status: "completed" });
});

test("terminal delivery releases cancellation without a turn start notification", async () => {
  const p = peer({ delayTurnStarted: true });
  peers.push(p);
  const a = await p.runtime.run(input("a", "p"));
  const stopped = a.stop();
  p.children[0].emit({
    method: "turn/completed",
    params: { threadId: a.agentSessionId, turn: { id: "turn-1", status: "completed" } },
  });
  const outcome = await Promise.race([stopped.then(() => "settled"), Bun.sleep(100).then(() => "pending")]);
  expect(outcome).toBe("settled");
  expect(await a.done).toEqual({ status: "cancelled" });
  expect(p.calls.some((call) => call.method === "turn/interrupt")).toBe(false);
});

test.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])("cancellation interrupts an already started goal turn (scope=%s, paused=%s)", async (scope, paused) => {
  const p = peer({ delayTurnStarted: true });
  peers.push(p);
  const a = input("a", "p");
  const threadId = await p.runtime.worker(a).load(a);
  p.children[0].emit({
    method: "turn/started",
    params: { threadId, turn: { id: "turn-1", status: "inProgress" } },
  });
  // turn/start steers this existing turn without another start notification.
  const session = await p.runtime.run(a);
  const other = await p.runtime.run(input("b", "q"));
  p.children[0].emit({
    method: "thread/goal/updated",
    params: { threadId, goal: { status: paused ? "paused" : "active" } },
  });
  const stopping = scope ? p.runtime.disposeScope("p") : session.stop();
  const outcome = await Promise.race([stopping.then(() => "stopped"), Bun.sleep(100).then(() => "pending")]);
  expect(outcome).toBe("stopped");
  expect(await session.done).toEqual({ status: "cancelled" });
  expect(p.calls.filter((call) => call.method === "turn/interrupt").map((call) => call.params)).toEqual([
    { threadId, turnId: "turn-1" },
  ]);
  if (!scope && !paused)
    expect(p.calls.some((call) => call.method === "thread/goal/set" && call.params.status === "paused")).toBe(true);
  p.children[0].emit({
    method: "turn/completed",
    params: { threadId: other.agentSessionId, turn: { id: "turn-2", status: "completed" } },
  });
  expect(await other.done).toEqual({ status: "completed" });
});

test.each([
  "thread/goal/get",
  "thread/unsubscribe",
])("scope cleanup releases a transport lost during %s", async (method) => {
  const { runtime, children, holdNext } = setup();
  const a = await runtime.run(input("a", "p"));
  const b = await runtime.run(input("b", "q"));
  children[0].emit({
    method: "turn/completed",
    params: { threadId: a.agentSessionId, turn: { id: "turn-1", status: "completed" } },
  });
  expect(await a.done).toEqual({ status: "completed" });
  const held = holdNext(method);
  const disposed = runtime.disposeScope("p").then(
    () => "released",
    (error) => error.message,
  );
  await held.requested;
  children[0].kill();
  expect(await disposed).toBe("released");
  expect(await b.done).toEqual({ status: "disconnected" });
});
