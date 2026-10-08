import { PassThrough, Writable } from "node:stream";
import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { createCodexRuntime } from "./codex-runtime";
import type { ThreadGoal } from "./protocol/v2/ThreadGoal";

export const createGoalCommandPeer = () => {
  const calls: Array<{ id: number; method: string; params: Record<string, unknown> }> = [];
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const exited = Promise.withResolvers<{ code: number | null; signal: string | null }>();
  const requested = Promise.withResolvers<void>();
  const emit = (value: unknown) => stdout.write(`${JSON.stringify(value)}\n`);
  let pendingGoal: { id: number } | undefined;
  const kill = () => {
    stdout.end();
    stderr.end();
    exited.resolve({ code: null, signal: "SIGTERM" });
  };
  const runtime = createCodexRuntime({
    spawnProcess: () => ({
      stdout,
      stderr,
      pid: 1,
      onExit: exited.promise,
      kill,
      stdin: new Writable({
        write(chunk, _encoding, done) {
          const message = JSON.parse(String(chunk));
          calls.push(message);
          if (message.id === undefined) {
            done();
            return;
          }
          if (message.method === "thread/goal/set") {
            pendingGoal = message;
            requested.resolve();
            done();
            return;
          }
          let result: unknown = {};
          if (message.method === "thread/start" || message.method === "thread/resume")
            result = { thread: { id: "native-thread", path: null } };
          if (message.method === "thread/goal/get") result = { goal: null };
          if (message.method === "turn/start") result = { turn: { id: "first" } };
          emit({ id: message.id, result });
          done();
        },
      }),
    }),
  });
  const messages: SessionMessage[] = [];
  const events = {
    getMessages: () => messages,
    push: (patch: JsonPatch) => {
      messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
    },
  };
  const input = { prompt: "Current task", events, env: { PSTDIO_SESSION_ID: "host-session" } };
  return {
    runtime,
    input,
    events,
    calls,
    messages,
    requested: requested.promise,
    kill,
    goal: (status: ThreadGoal["status"]) => ({
      threadId: "native-thread",
      objective: "New objective",
      status,
      tokensUsed: 0,
      tokenBudget: null,
      timeUsedSeconds: 0,
      createdAt: 1,
      updatedAt: 2,
    }),
    notifyGoal: (status: ThreadGoal["status"] | null) =>
      emit({
        method: status ? "thread/goal/updated" : "thread/goal/cleared",
        params: { threadId: "native-thread", ...(status ? { goal: { status } } : {}) },
      }),
    complete: (id = "first", status = "completed") =>
      emit({
        method: "turn/completed",
        params: { threadId: "native-thread", turn: { id, status } },
      }),
    startNext: () =>
      emit({
        method: "turn/started",
        params: { threadId: "native-thread", turn: { id: "next" } },
      }),
    question: () =>
      emit({
        id: "question-request",
        method: "item/tool/requestUserInput",
        params: {
          threadId: "native-thread",
          turnId: "first",
          itemId: "question",
          questions: [{ id: "choice", question: "Choose", options: [{ label: "One" }] }],
        },
      }),
    userFirst: () =>
      emit({
        method: "item/started",
        params: {
          threadId: "native-thread",
          turnId: "first",
          item: { id: "user-first", type: "userMessage", content: [{ type: "text", text: "Current task" }] },
        },
      }),
    answerNext: () =>
      emit({
        method: "item/completed",
        params: {
          threadId: "native-thread",
          turnId: "next",
          item: { id: "answer", type: "agentMessage", text: "Following the new goal" },
        },
      }),
    replyGoal: (goal: ThreadGoal) => emit({ id: pendingGoal?.id, result: { goal } }),
    rejectGoal: () => emit({ id: pendingGoal?.id, error: { code: -32000, message: "Goal rejected" } }),
  };
};
