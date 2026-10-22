import { afterEach, expect, test } from "bun:test";
import { peer, sink } from "./shared-server-peer";

const peers: ReturnType<typeof peer>[] = [];
afterEach(async () => {
  for (const p of peers.splice(0)) await p.runtime.dispose();
});
const setup = (options?: Parameters<typeof peer>[0]) => {
  const p = peer(options);
  peers.push(p);
  return p;
};
const input = (id: string, project = "p") => ({
  prompt: id,
  events: sink(),
  env: { PSTDIO_SESSION_ID: id, PSTDIO_PROJECT_ID: project },
});
const complete = (p: ReturnType<typeof peer>, threadId: string, turnId = "turn-1") =>
  p.children[0].emit({ method: "turn/completed", params: { threadId, turn: { id: turnId, status: "completed" } } });

test.each([
  "active",
  "paused",
])("idle cleanup preserves a %s goal without pausing or clearing it", async (goalStatus) => {
  const p = setup({ goalStatus });
  const a = input("a");
  await p.runtime.worker(a).load(a);
  expect(await p.runtime.releaseSession("p", "a")).toBe(goalStatus === "paused");
  expect(p.calls.some((call) => ["thread/goal/set", "thread/goal/clear", "turn/interrupt"].includes(call.method))).toBe(
    false,
  );
});

test("a pending native load prevents idle release", async () => {
  const p = setup();
  const a = input("a");
  const held = p.holdNext("thread/start");
  const worker = p.runtime.worker(a);
  const loading = worker.load(a);
  await held.requested;
  expect(await p.runtime.releaseSession("p", "a")).toBe(false);
  held.reply();
  await loading;
  expect(await p.runtime.releaseSession("p", "a")).toBe(true);
});

test("uncertain native delivery prevents idle release", async () => {
  const p = setup({ recoveryActive: true });
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
  expect(await p.runtime.releaseSession("p", "a")).toBe(false);
  expect(p.calls.some((call) => call.method === "thread/unsubscribe")).toBe(false);
});

test("idle cleanup releases one session while another owner keeps the server alive", async () => {
  const p = setup();
  const a = input("a");
  const first = await p.runtime.run(a);
  const other = await p.runtime.run(input("b"));
  complete(p, first.agentSessionId!);
  await first.done;
  expect(await p.runtime.releaseSession("p", "a")).toBe(true);
  expect(p.calls.filter((call) => call.method === "thread/unsubscribe").map((call) => call.params.threadId)).toEqual([
    first.agentSessionId,
  ]);
  expect(p.children).toHaveLength(1);
  expect(p.runtime.worker(input("b")).isClosed()).toBe(false);
  const resumed = await p.runtime.run({ ...a, agentSessionId: first.agentSessionId! });
  expect(resumed.agentSessionId).toBe(first.agentSessionId);
  expect(p.calls.filter((call) => call.method === "thread/resume")).toHaveLength(1);
  await resumed.stop();
  await other.stop();
});

test("active runs and native turns prevent idle release", async () => {
  const p = setup();
  const a = input("a");
  const run = await p.runtime.run(a);
  expect(await p.runtime.releaseSession("p", "a")).toBe(false);
  expect(p.calls.some((call) => call.method === "thread/unsubscribe")).toBe(false);
  await run.stop();
  p.children[0].emit({
    method: "turn/started",
    params: { threadId: run.agentSessionId, turn: { id: "autonomous", status: "inProgress" } },
  });

  expect(await p.runtime.releaseSession("p", "a")).toBe(false);
  complete(p, run.agentSessionId!, "autonomous");
  expect(await p.runtime.releaseSession("p", "a")).toBe(true);
});

test("pending controls and a native turn arriving during idle checks prevent release", async () => {
  const p = setup();
  const a = input("a");
  const worker = p.runtime.worker(a);
  const id = await worker.load(a);
  const pending = p.holdNext("thread/goal/get");
  const reading = worker.request("thread/goal/get", { threadId: id });
  await pending.requested;
  expect(await p.runtime.releaseSession("p", "a")).toBe(false);
  pending.reply();
  await reading;
  const check = p.holdNext("thread/goal/get");
  const releasing = p.runtime.releaseSession("p", "a");
  await check.requested;
  p.children[0].emit({ method: "turn/started", params: { threadId: id, turn: { id: "goal", status: "inProgress" } } });
  check.reply();
  expect(await releasing).toBe(false);
  expect(worker.isClosed()).toBe(false);
});

test("idle cleanup respects host session and project boundaries and releases unused owners", async () => {
  const p = setup();
  const first = p.runtime.worker(input("same", "p"));
  const other = p.runtime.worker(input("same", "q"));
  expect(await p.runtime.releaseSession("p", "same")).toBe(true);
  expect(first.isClosed()).toBe(true);
  expect(other.isClosed()).toBe(false);
  expect(await p.runtime.releaseSession("p", "missing")).toBe(true);
  expect(await p.runtime.releaseSession("q", "same")).toBe(true);
  expect(other.isClosed()).toBe(true);
});

test("a newer native goal update prevents release after an older goal snapshot", async () => {
  const p = setup({ goalStatus: "paused" });
  const a = input("a");
  const id = await p.runtime.worker(a).load(a);
  const check = p.holdNext("thread/goal/get");
  const releasing = p.runtime.releaseSession("p", "a");
  await check.requested;
  check.reply();
  p.children[0].emit({ method: "thread/goal/updated", params: { threadId: id, goal: { status: "active" } } });
  expect(await releasing).toBe(false);
  expect(p.calls.some((call) => call.method === "thread/unsubscribe")).toBe(false);
});

test("a pending async answer keeps ownership after its native turn completes", async () => {
  const p = setup();
  const a = input("a");
  const run = await p.runtime.run(a);
  p.children[0].emit({
    method: "item/completed",
    params: {
      threadId: run.agentSessionId,
      turnId: "turn-1",
      item: {
        id: "async",
        type: "agentMessage",
        text: "Which color?",
        delivery: "async",
        questions: [{ title: "Which color?", options: ["Blue", "Green"] }],
      },
    },
  });
  const held = p.holdNext("turn/steer");
  const answering = run.replyQuestion!({ callId: "async", answers: [["Blue"]] });
  await held.requested;
  complete(p, run.agentSessionId!);
  await run.done;
  expect(await p.runtime.releaseSession("p", "a")).toBe(false);
  held.reply();
  await answering;
  expect(await p.runtime.releaseSession("p", "a")).toBe(true);
});
