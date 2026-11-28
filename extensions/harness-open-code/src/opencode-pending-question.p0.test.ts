import { expect, test } from "bun:test";
import { pollOpencodeMessages } from "./opencode-session-poller";
import { questionAssistant, recordingSink, userMessage } from "./opencode-session-poller.test-helpers";

test("streaming question arguments keep the turn active until the question is running", async () => {
  const question = questionAssistant();
  if (!("parts" in question)) throw new Error("Expected tool parts");
  const part = question.parts![1]!;
  part.state!.status = "pending";
  const { sink, patches } = recordingSink();
  const abort = new AbortController();
  const done = pollOpencodeMessages({
    loadMessages: async () => [userMessage("Build a tool"), question],
    sessionId: "session",
    cwd: undefined,
    events: sink,
    baselineCount: 1,
    messageComplete: new Promise(() => {}),
    abortSignal: abort.signal,
    pollIntervalMs: 1,
  });
  try {
    await Bun.sleep(20);
    expect(patches.filter((patch) => patch.path === "/status")).toEqual([]);
    part.state!.status = "running";
    expect(await Promise.race([done, Bun.sleep(100).then(() => null)])).toEqual({ status: "completed" });
  } finally {
    abort.abort();
    await done;
  }
});

test("an admitted follow-up exposes an existing question without waiting for native idle", async () => {
  const messages = [userMessage("Build a tool"), questionAssistant()];
  const { sink, patches } = recordingSink();
  const abort = new AbortController();
  const admitted = Promise.withResolvers<void>();
  const done = pollOpencodeMessages({
    loadMessages: async () => messages,
    sessionId: "session",
    cwd: undefined,
    events: sink,
    baselineCount: messages.length,
    messageAccepted: admitted.promise,
    messageComplete: admitted.promise.then(() => new Promise<void>(() => {})),
    abortSignal: abort.signal,
    pollIntervalMs: 1,
  });
  try {
    await Bun.sleep(20);
    expect(patches.filter((patch) => patch.path === "/status")).toEqual([]);
    admitted.resolve();
    expect(await Promise.race([done, Bun.sleep(100).then(() => null)])).toEqual({ status: "completed" });
    expect(sink.getMessages().at(-1)?.parts).toContainEqual(
      expect.objectContaining({ type: "tool", tool: "question", status: "running" }),
    );
  } finally {
    abort.abort();
    await done;
  }
});

test("a pending question does not hide rejected follow-up admission", async () => {
  const messages = [userMessage("Build a tool"), questionAssistant()];
  const { sink } = recordingSink();
  const admitted = Promise.withResolvers<void>();
  const done = pollOpencodeMessages({
    loadMessages: async () => messages,
    sessionId: "session",
    cwd: undefined,
    events: sink,
    baselineCount: messages.length,
    messageAccepted: admitted.promise,
    messageComplete: admitted.promise,
    pollIntervalMs: 1,
  });
  admitted.reject(new Error("OpenCode did not accept the prompt."));
  expect(await done).toEqual({ status: "failed" });
  expect(sink.getMessages().at(-1)?.parts).toContainEqual(
    expect.objectContaining({ type: "error", message: "OpenCode did not accept the prompt." }),
  );
});
