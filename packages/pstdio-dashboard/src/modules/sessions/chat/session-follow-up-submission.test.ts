import { beforeEach, expect, test } from "bun:test";
import { type FollowUpMutation, submitSessionMessage } from "./session-chat-actions";
import { getPendingFollowUp, mergeMessagesWithPendingFollowUp, updatePendingFollowUp } from "./session-chat-state";

type FollowUpResult = Awaited<ReturnType<FollowUpMutation["mutateAsync"]>>;

const deferred = () => {
  let resolve!: (result: FollowUpResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<FollowUpResult>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const current = () => getPendingFollowUp("session-1");
const submission = (followUp: FollowUpMutation, onSubmitted: () => void, answers?: string[][]) =>
  submitSessionMessage({
    conversationKey: "session-1",
    sessionId: "session-1",
    projectId: "project-1",
    agent: "codex",
    model: "model-1",
    text: "Next turn",
    messages: [],
    createSession: { mutateAsync: () => Promise.reject(new Error("Must use existing session")) },
    followUp,
    reconnect: () => undefined,
    onSubmitted,
    questionResponse: answers ? { answers } : undefined,
  });

beforeEach(() => updatePendingFollowUp("session-1", null));

test("hands off the draft immediately but waits for server acceptance before completing", async () => {
  const response = deferred();
  let submitted = false;
  const result = submission(
    {
      mutateAsync: (input) => {
        expect(input).toMatchObject({ sessionId: "session-1", prompt: "Next turn", agent: "codex", model: "model-1" });
        return response.promise;
      },
    },
    () => {
      submitted = true;
    },
  );
  expect(submitted).toBe(true);
  expect(current()?.prompt).toBe("Next turn");
  let settled = false;
  void result.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  response.resolve({ status: "in_progress", followUp: { status: "queued", queue_position: 1 } });
  await result;
  expect(submitted).toBe(true);
});

test("a follow-up shows in the conversation while it is being sent", () => {
  const beforeSubmission = Date.now();
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  expect(current()?.submittedAt).toBeGreaterThanOrEqual(beforeSubmission);
  expect(current()?.submittedAt).toBeLessThanOrEqual(Date.now());
  expect(mergeMessagesWithPendingFollowUp([], current()).map((message) => message.parts[0])).toEqual([
    { type: "text", text: "Next turn" },
    { type: "loading" },
  ]);
});

test("a follow-up that cannot be sent stays in the conversation as unsent", async () => {
  let submitted = false;
  await submission({ mutateAsync: () => Promise.reject(new TypeError("Failed to fetch")) }, () => {
    submitted = true;
  });
  expect(submitted).toBe(true);
  expect(current()?.failure).toEqual({ message: "The network is unavailable.", temporary: true });
  expect(mergeMessagesWithPendingFollowUp([], current())).toEqual([
    expect.objectContaining({ role: "user", delivery: "unsent", parts: [{ type: "text", text: "Next turn" }] }),
  ]);
});

test("a queued follow-up leaves the conversation to the queued list", async () => {
  await submission(
    { mutateAsync: async () => ({ status: "in_progress", followUp: { status: "queued", queue_position: 2 } }) },
    () => undefined,
  );
  expect(current()).toBeNull();
});

test("an accepted question answer clears its pending submission without a new user turn", async () => {
  const response = deferred();
  let submitted = false;
  const result = submission({ mutateAsync: () => response.promise }, () => {
    submitted = true;
  }, [["Blue"]]);
  expect(submitted).toBe(false);
  response.resolve({ status: "in_progress", followUp: { status: "dispatched" } });
  await result;
  expect(submitted).toBe(true);
  expect(current()).toBeNull();
});

test("a rejected question reply preserves the form for retry", async () => {
  let submitted = false;
  const result = submission({ mutateAsync: () => Promise.reject(new Error("Native reply rejected")) }, () => {
    submitted = true;
  }, [["Blue"]]);
  await expect(result).rejects.toThrow("Native reply rejected");
  expect(submitted).toBe(false);
  expect(current()?.failure).toBeDefined();
});

test("shows an accepted follow-up once while its run timestamp is still syncing", () => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  const accepted = [{ id: "accepted", role: "user" as const, parts: [{ type: "text" as const, text: "Next turn" }] }];
  expect(mergeMessagesWithPendingFollowUp(accepted, current())).toEqual(accepted);
});

test("assistant messages arriving during submission keep the pending user turn visible", () => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  const streaming = [
    { id: "streaming", role: "assistant" as const, parts: [{ type: "text" as const, text: "Still working" }] },
  ];
  expect(mergeMessagesWithPendingFollowUp(streaming, current())).toHaveLength(3);
  expect(mergeMessagesWithPendingFollowUp(streaming, current())[1].parts).toEqual([
    { type: "text", text: "Next turn" },
  ]);
});

test("another user turn does not acknowledge a different pending submission", () => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  const other = [{ id: "other", role: "user" as const, parts: [{ type: "text" as const, text: "A different turn" }] }];
  expect(mergeMessagesWithPendingFollowUp(other, current())).toHaveLength(3);
});

test("a session follow-up belongs only to its own session", () => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  expect(current()?.prompt).toBe("Next turn");
  expect(getPendingFollowUp("session-2")).toBeNull();
  expect(getPendingFollowUp("draft")).toBeNull();
});
