import { afterEach, expect, test } from "bun:test";
import { PassThrough, Writable } from "node:stream";
import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { createCodexRuntime } from "./codex-runtime";

const runtimes: ReturnType<typeof createCodexRuntime>[] = [];
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose();
});
const loseAcknowledgement = (method: string, lose?: boolean) => method === "turn/start" && lose;
const readState = (id: string, active?: boolean) => ({
  thread: {
    id,
    turns: active ? [{ id: "unresolved", status: "inProgress", items: [] }] : [],
  },
});
const peer = (options: { loseTurnAck?: boolean; recoveryActive?: boolean } = {}) => {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const children: Array<{ emit: (value: unknown) => void; kill: () => void }> = [];
  const deps = {
    spawnProcess: () => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const exited = Promise.withResolvers<{ code: number | null; signal: string | null }>();
      const emit = (value: unknown) => stdout.write(`${JSON.stringify(value)}\n`);
      let turn = 0;
      const stdin = new Writable({
        write(chunk, _encoding, done) {
          const m = JSON.parse(String(chunk));
          calls.push(m);
          if (loseAcknowledgement(m.method, options.loseTurnAck)) {
            kill();
            done();
            return;
          }
          if (m.id === undefined) {
            done();
            return;
          }
          {
            let result: unknown = {};
            if (m.method === "thread/start" || m.method === "thread/resume")
              result = { thread: { id: m.params.threadId ?? `thread-${children.length}`, path: null } };
            if (m.method === "turn/start") {
              turn++;
              result = { turn: { id: `turn-${turn}`, status: "inProgress" } };
            }
            if (m.method === "thread/read") result = readState(m.params.threadId, options.recoveryActive);
            emit({ id: m.id, result });
            if (m.method === "turn/interrupt")
              emit({
                method: "turn/completed",
                params: { threadId: m.params.threadId, turn: { id: m.params.turnId, status: "interrupted" } },
              });
          }
          done();
        },
      });
      const kill = () => {
        stdout.end();
        stderr.end();
        exited.resolve({ code: null, signal: "SIGTERM" });
      };
      children.push({ emit, kill });
      return { stdin, stdout, stderr, kill, pid: children.length, onExit: exited.promise };
    },
  };
  const runtime = createCodexRuntime(deps);
  runtimes.push(runtime);
  return { runtime, calls, children };
};
const sink = () => {
  const messages: SessionMessage[] = [];
  return {
    getMessages: () => messages,
    push: (patch: JsonPatch) => {
      messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
    },
  };
};
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
  expect(children).toHaveLength(2);
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
  expect(children).toHaveLength(3);
  await runtime.dispose();
  expect(await recovered.done).toEqual({ status: "cancelled" });
  expect(await second.done).toEqual({ status: "cancelled" });
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
