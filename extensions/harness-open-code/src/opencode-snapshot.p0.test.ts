import { expect, test } from "bun:test";
import type { SessionMessageInfo } from "@opencode/client";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import { toSessionSnapshot } from "./opencode-snapshot";
import { isTurnCompleted, isTurnInFlight } from "./opencode-turn-state";

const step: SessionMessageInfo = {
  id: "msg_step",
  type: "assistant",
  agent: "build",
  model: { providerID: "local", id: "test" },
  time: { created: 1700000000000, completed: 1700000001000 },
  finish: "tool-calls",
  content: [
    {
      type: "tool",
      id: "call_shell",
      name: "bash",
      time: { created: 1700000000000 },
      state: { status: "completed", input: { command: "echo hi" }, content: [{ type: "text", text: "hi" }] },
    },
  ],
};

test("a completed model step stays running until OpenCode records execution idle", () => {
  const busy = toSessionSnapshot([step]);
  expect(isTurnInFlight(busy)).toBe(true);
  expect(isTurnCompleted(busy)).toBe(false);
  const complete = toSessionSnapshot([
    step,
    { type: "idle", id: "msg_idle", outcome: "succeeded", time: { created: 1700000002000 } },
  ]);
  expect(isTurnCompleted(complete)).toBe(true);
  expect(normalizeOpencodeMessage(complete[0]!, 0)).toMatchObject({
    id: "msg_step",
    modelId: "test",
    providerId: "local",
    parts: [{ type: "tool", tool: "bash", callId: "call_shell", state: { status: "completed", output: "hi" } }],
  });
});

test("execution errors remain visible even after a completed tool step", () => {
  const messages = toSessionSnapshot([
    step,
    {
      type: "idle",
      id: "msg_failed",
      outcome: "failed",
      time: { created: 1700000002000 },
      error: { type: "api", message: "provider unavailable" },
    },
  ]);
  expect(normalizeOpencodeMessage(messages[0]!, 0).parts).toContainEqual(
    expect.objectContaining({ type: "error", message: "provider unavailable" }),
  );
});

test("a failure before the first model step terminates with its native error", () => {
  const snapshot = toSessionSnapshot([
    { type: "user", id: "msg_user", text: "hello", time: { created: 1 } },
    {
      type: "idle",
      id: "msg_idle",
      outcome: "failed",
      error: { type: "config", message: "No model selected" },
      time: { created: 2 },
    },
  ]);
  expect(isTurnCompleted(snapshot)).toBe(true);
  expect(normalizeOpencodeMessage(snapshot[1]!, 1).parts).toContainEqual(
    expect.objectContaining({ type: "error", message: "No model selected" }),
  );
});

test("failed and interrupted native outcomes do not become successful replies", async () => {
  const { pollOpencodeUntilIdle } = await import("./opencode-session-poller");
  const { recordingSink } = await import("./opencode-session-poller.test-helpers");
  for (const outcome of ["failed", "interrupted"] as const) {
    const snapshot = toSessionSnapshot([{ type: "idle", id: "msg_idle", outcome, time: { created: 2 } }]);
    expect(
      await pollOpencodeUntilIdle({
        loadMessages: async () => snapshot,
        sessionId: "ses_test",
        cwd: "/workspace",
        events: recordingSink().sink,
      }),
    ).toEqual({ status: outcome === "interrupted" ? "cancelled" : "failed" });
  }
});

test("an answered question stays in flight while native execution continues", () => {
  const question: SessionMessageInfo = {
    ...step,
    content: [
      {
        type: "tool",
        id: "call_question",
        name: "question",
        time: { created: 1 },
        state: {
          status: "completed",
          input: { questions: [] },
          content: [{ type: "text", text: "The user answered." }],
        },
      },
    ],
  };
  expect(isTurnInFlight(toSessionSnapshot([question]))).toBe(true);
  expect(isTurnCompleted(toSessionSnapshot([question]))).toBe(false);
  expect(
    isTurnCompleted(
      toSessionSnapshot([question, { type: "idle", id: "msg_idle", outcome: "succeeded", time: { created: 2 } }]),
    ),
  ).toBe(true);
});
