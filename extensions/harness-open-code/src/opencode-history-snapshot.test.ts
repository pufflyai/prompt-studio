import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { pollOpencodeQuestionReply } from "./opencode-question-reply-poller";
import { appendFailureMessage, pollOpencodeMessages, readSessionSnapshot } from "./opencode-session-poller";
import { completedAssistant, recordingSink, userMessage } from "./opencode-session-poller.test-helpers";

const failure: SessionMessage = {
  id: "opencode-error-s-1",
  role: "system",
  parts: [{ type: "error", errorType: "other", message: "local failure" }],
};
const user: SessionMessage = { id: "old-user", role: "user", parts: [{ type: "text", text: "again" }] };

test("a poll reads the current owner after its native read finishes", async () => {
  const { sink } = recordingSink();
  sink.push({ op: "replace", path: "/messages", value: [user] });
  const native = Promise.withResolvers<ReturnType<typeof userMessage>[]>();
  const polling = readSessionSnapshot({
    events: sink,
    sessionId: "s",
    cwd: undefined,
    loadMessages: () => native.promise,
    lastObserved: [],
    lastSnapshot: "",
  });
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  native.resolve([userMessage("again")]);
  await polling;
  expect(sink.getMessages()).toHaveLength(2);
  expect(sink.getMessages().at(-1)).toEqual(failure);
});

test("ambiguous poll metadata preserves saved content and publishes fresh agent output", async () => {
  const { sink, patches } = recordingSink();
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  const raw = [userMessage("again"), userMessage("again"), completedAssistant("done")];
  const result = await readSessionSnapshot({
    events: sink,
    sessionId: "s",
    cwd: undefined,
    loadMessages: async () => raw,
    lastObserved: [],
    lastSnapshot: "",
  });
  expect(sink.getMessages().slice(0, 2)).toEqual([user, failure]);
  expect(sink.getMessages().at(-1)?.parts).toEqual([{ type: "text", text: "done" }]);
  expect(result.lastObserved).toEqual(raw);
  expect(patches.some((patch) => patch.path === "/history_issue")).toBe(false);
});

test("a generated failure appends to the current conversation", () => {
  const { sink } = recordingSink();
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  appendFailureMessage({ events: sink, sessionId: "s", failureMessage: "new failure" });
  expect(sink.getMessages().slice(0, 2)).toEqual([user, failure]);
});

test("an earlier generated failure does not fail a later successful turn", async () => {
  const { sink } = recordingSink();
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  const result = await pollOpencodeMessages({
    events: sink,
    sessionId: "s",
    cwd: undefined,
    loadMessages: async () => [userMessage("again"), userMessage("retry"), completedAssistant("done")],
    baselineCount: 1,
    messageComplete: Promise.resolve(),
  });
  expect(sink.getMessages()).toContainEqual(failure);
  expect(result).toEqual({ status: "completed" });
});

test("a question answer survives an ambiguous history and completes the turn", async () => {
  const { sink } = recordingSink();
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  const result = await pollOpencodeQuestionReply({
    events: sink,
    sessionId: "s",
    cwd: undefined,
    questionTool: { messageID: "question", callID: "call" },
    questionResponse: { answers: [["yes"]] },
    loadMessages: async () => [
      userMessage("again"),
      userMessage("again"),
      {
        info: { id: "question", role: "assistant", time: { completed: 1 } },
        parts: [{ type: "tool", tool: "question", callID: "call", state: { status: "completed" } }],
      },
    ],
    messageComplete: Promise.resolve(),
    pollIntervalMs: 1,
  });
  expect(result).toEqual({ status: "completed" });
  expect(sink.getMessages().filter((message) => message.id === failure.id)).toEqual([failure]);
  expect(sink.getMessages().at(-1)?.parts).toMatchObject([
    { type: "tool", state: { metadata: { answers: [["yes"]] } } },
  ]);
});
