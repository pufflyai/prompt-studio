import { afterEach, expect, test } from "bun:test";
import type { createCodexRuntime } from "./codex-runtime";
import { peer as createPeer, sink } from "./shared-server-peer";

const runtimes: ReturnType<typeof createCodexRuntime>[] = [];
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose();
});
const peer = (options: Parameters<typeof createPeer>[0] = {}) => {
  const p = createPeer(options);
  runtimes.push(p.runtime);
  return p;
};
test("native command notifications follow only their session and detach without stopping execution", async () => {
  const { runtime, children } = peer();
  const input = { prompt: "hello", events: sink(), env: { PSTDIO_PROJECT_ID: "p", PSTDIO_SESSION_ID: "one" } };
  const first = await runtime.run(input);
  const second = await runtime.run({ ...input, env: { ...input.env, PSTDIO_SESSION_ID: "two" } });
  let changes = 0;
  const close = runtime.observeCommands(input, () => changes++);
  children[0].emit({
    method: "thread/goal/updated",
    params: { threadId: second.agentSessionId, goal: { status: "active" } },
  });
  await Bun.sleep(0);
  expect(changes).toBe(0);
  children[0].emit({
    method: "thread/goal/updated",
    params: { threadId: first.agentSessionId, goal: { status: "active" } },
  });
  await Bun.sleep(0);
  expect(changes).toBe(1);
  close();
  children[0].emit({ method: "thread/goal/cleared", params: { threadId: first.agentSessionId } });
  await Bun.sleep(0);
  expect(changes).toBe(1);
  await first.stop();
  await second.stop();
});
test("rediscovers a thread's native default without passing host model or parameter overrides", async () => {
  const { runtime, calls } = peer();
  const worker = runtime.worker({
    prompt: "",
    events: sink(),
    model: "next-selection",
    params: { model_reasoning_effort: "high", service_tier: "fast" },
  });
  expect(await worker.readModel("existing-thread")).toBe("native-default");
  const read = calls.find((call) => call.method === "thread/read")?.params;
  expect(read).toEqual({ threadId: "existing-thread", includeTurns: false });
  expect(calls.some((call) => call.method === "thread/resume")).toBe(false);
  expect(calls.some((call) => call.method === "turn/start")).toBe(false);
});

test("fresh saved-thread observation reads metadata without resuming execution or hydrating history", async () => {
  const { runtime, calls } = peer();
  const input = { prompt: "", events: sink(), agentSessionId: "saved-thread", env: { PSTDIO_SESSION_ID: "saved" } };
  let first = 0;
  let second = 0;
  const close = runtime.observeCommands(input, () => first++);
  const closeSecond = runtime.observeCommands(input, () => second++);
  await Bun.sleep(0);
  expect({ first, second }).toEqual({ first: 1, second: 1 });
  expect(calls.filter((call) => call.method === "thread/read").map((call) => call.params)).toEqual([
    { threadId: "saved-thread", includeTurns: false },
  ]);
  expect(calls.find((call) => call.method === "thread/turns/list")?.params).toEqual({
    threadId: "saved-thread",
    limit: 1,
    sortDirection: "desc",
    itemsView: "notLoaded",
  });
  expect(calls.some((call) => ["thread/resume", "thread/start", "turn/start"].includes(call.method))).toBe(false);
  expect(runtime.worker(input).threadId()).toBeUndefined();
  close();
  closeSecond();
});
test("reads the native model without applying the next-turn selection and tracks acknowledged turns", async () => {
  const { runtime, children, calls } = peer();
  const input = { prompt: "hello", events: sink(), env: { PSTDIO_SESSION_ID: "model-readback" } };
  const session = await runtime.run(input);
  const worker = runtime.worker({ ...input, model: "next-model" });
  expect(worker.model()).toBe("native-default");
  children[0].emit({
    method: "turn/completed",
    params: { threadId: session.agentSessionId, turn: { id: "turn-1", status: "completed" } },
  });
  await session.done;
  const next = await runtime.run({ ...input, model: "next-model", agentSessionId: session.agentSessionId });
  expect(worker.model()).toBe("next-model");
  expect(calls.filter((call) => call.method === "thread/start")).toHaveLength(1);
  await next.stop();
});
test("reuses the session worker across completed turns and interrupts only the active turn", async () => {
  const { runtime, calls, children } = peer();
  const events = sink();
  const input = { prompt: "hello", events, env: { PSTDIO_SESSION_ID: "one", PSTDIO_PROJECT_ID: "p" } };
  const first = await runtime.run(input);
  children[0].emit({
    method: "turn/completed",
    params: { threadId: first.agentSessionId, turn: { id: "turn-1", status: "completed" } },
  });
  expect(await first.done).toEqual({ status: "completed" });
  const next = await runtime.run({ ...input, agentSessionId: first.agentSessionId, prompt: "again" });
  expect(children).toHaveLength(1);
  expect(calls.filter((c) => c.method === "thread/start")).toHaveLength(1);
  await next.stop();
  expect(await next.done).toEqual({ status: "cancelled" });
  expect(calls.find((c) => c.method === "turn/interrupt")?.params.turnId).toBe("turn-2");
});
test("isolates workers and recreates a lost worker on the recorded native thread without replay", async () => {
  const { runtime, calls, children } = peer();
  const first = await runtime.run({ prompt: "one", events: sink(), env: { PSTDIO_SESSION_ID: "one" } });
  const second = await runtime.run({ prompt: "two", events: sink(), env: { PSTDIO_SESSION_ID: "two" } });
  expect(children).toHaveLength(1);
  children[0].kill();
  expect(await first.done).toEqual({ status: "disconnected" });
  const recovered = await runtime.run({
    prompt: "new explicit input",
    agentSessionId: first.agentSessionId,
    events: sink(),
    env: { PSTDIO_SESSION_ID: "one" },
  });
  expect(calls.filter((c) => c.method === "turn/start")).toHaveLength(3);
  expect(calls.find((c) => c.method === "thread/resume")?.params.threadId).toBe(first.agentSessionId);
  expect(children).toHaveLength(2);
  await runtime.dispose();
  expect(await recovered.done).toEqual({ status: "cancelled" });
  expect(await second.done).toEqual({ status: "disconnected" });
});
test("compaction remains exclusive after acknowledgement and ignores another turn's completion", async () => {
  const { runtime, children } = peer();
  const run = await runtime.run(
    { prompt: "/compact", agentSessionId: "existing", events: sink(), env: { PSTDIO_SESSION_ID: "one" } },
    { method: "thread/compact/start", params: {} },
  );
  let complete = false;
  void run.done.then(() => {
    complete = true;
  });
  children[0].emit({
    method: "turn/completed",
    params: { threadId: "existing", turn: { id: "old", status: "completed" } },
  });
  await Bun.sleep(1);
  expect(complete).toBe(false);
  children[0].emit({
    method: "turn/started",
    params: { threadId: "existing", turn: { id: "compact", status: "inProgress" } },
  });
  children[0].emit({
    method: "turn/completed",
    params: { threadId: "existing", turn: { id: "compact", status: "completed" } },
  });
  expect(await run.done).toEqual({ status: "completed" });
});
test("pausing a goal between native turns releases its execution slot", async () => {
  const { runtime, children } = peer();
  const run = await runtime.run(
    { prompt: "/goal task", events: sink() },
    { method: "thread/goal/set", params: { objective: "task" }, goal: true },
  );
  children[0].emit({
    method: "turn/started",
    params: { threadId: run.agentSessionId, turn: { id: "goal", status: "inProgress" } },
  });
  children[0].emit({
    method: "turn/completed",
    params: { threadId: run.agentSessionId, turn: { id: "goal", status: "completed" } },
  });
  children[0].emit({
    method: "thread/goal/updated",
    params: { threadId: run.agentSessionId, goal: { status: "paused" } },
  });
  expect(await run.done).toEqual({ status: "completed" });
});
test("disposing the host scope leaves project-owned workers alone", async () => {
  const { runtime } = peer();
  const project = await runtime.run({
    prompt: "project",
    events: sink(),
    env: { PSTDIO_PROJECT_ID: "p", PSTDIO_SESSION_ID: "p" },
  });
  const host = await runtime.run({ prompt: "host", events: sink(), env: { PSTDIO_SESSION_ID: "h" } });
  await runtime.disposeScope();
  expect(await host.done).toEqual({ status: "cancelled" });
  expect(
    runtime
      .worker({ prompt: "project", events: sink(), env: { PSTDIO_PROJECT_ID: "p", PSTDIO_SESSION_ID: "p" } })
      .isClosed(),
  ).toBe(false);
  await project.stop();
});

test("a lost initial turn acknowledgement retains its native thread for recovery", async () => {
  const { runtime } = peer({ loseTurnAck: true });
  const run = await runtime.run({ prompt: "one", events: sink(), env: { PSTDIO_SESSION_ID: "one" } });
  expect(run.agentSessionId).toBe("thread-1");
  expect(await run.done).toEqual({ status: "disconnected" });
});
test("recovery does not send a new mutation while native execution is unresolved", async () => {
  const { runtime, calls } = peer({ recoveryActive: true });
  await expect(
    runtime.run({ prompt: "new explicit input", agentSessionId: "existing", events: sink() }),
  ).rejects.toThrow("Native Codex execution is still in progress");
  expect(calls.filter((c) => c.method === "turn/start")).toHaveLength(0);
});
