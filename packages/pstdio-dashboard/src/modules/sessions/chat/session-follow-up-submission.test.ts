import { expect, test } from "bun:test";
import { type FollowUpMutation, submitSessionMessage } from "./session-chat-actions";
import {
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  shouldShowPendingFollowUp,
} from "./session-chat-state";

let pending: PendingFollowUpState | null = null;
// The submission assigns this through a callback, which TypeScript cannot see after a reset.
const current = (): PendingFollowUpState | null => pending;
const submission = (followUp: FollowUpMutation, onSubmitted: () => void, answers?: string[][]) =>
  submitSessionMessage({
    sessionId: "session-1",
    projectId: "project-1",
    agent: "codex",
    model: "model-1",
    text: "Next turn",
    messages: [],
    pendingIdRef: { current: 0 },
    setPendingFollowUp: (next) => {
      pending = typeof next === "function" ? next(pending) : next;
    },
    createSession: {
      mutate: () => {
        throw new Error("Must use existing session");
      },
    },
    followUp,
    reconnect: () => undefined,
    onSubmitted,
    questionResponse: answers ? { answers } : undefined,
  });

test("waits for server acceptance before completing a follow-up submission", async () => {
  let accept!: Parameters<FollowUpMutation["mutate"]>[1]["onSuccess"];
  let submitted = false;
  const result = submission(
    {
      mutate: (input, options) => {
        expect(input).toMatchObject({ sessionId: "session-1", prompt: "Next turn", agent: "codex", model: "model-1" });
        accept = options.onSuccess;
      },
    },
    () => {
      submitted = true;
    },
  );
  expect(result).toBeInstanceOf(Promise);
  expect(submitted).toBe(false);
  accept({ status: "in_progress", followUp: { status: "queued", queue_position: 1 } });
  await result;
  expect(submitted).toBe(true);
});

test("a follow-up shows in the conversation while it is being sent", () => {
  pending = null;
  const beforeSubmission = Date.now();
  void submission({ mutate: () => undefined }, () => undefined);
  expect(current()?.submittedAt).toBeGreaterThanOrEqual(beforeSubmission);
  expect(current()?.submittedAt).toBeLessThanOrEqual(Date.now());
  expect(mergeMessagesWithPendingFollowUp([], current()).map((message) => message.parts[0])).toEqual([
    { type: "text", text: "Next turn" },
    { type: "loading" },
  ]);
});

test("a follow-up that cannot be sent stays in the conversation as unsent", async () => {
  pending = null;
  let reject!: Parameters<FollowUpMutation["mutate"]>[1]["onError"];
  let submitted = false;
  const result = submission(
    {
      mutate: (_input, options) => {
        reject = options.onError;
      },
    },
    () => {
      submitted = true;
    },
  );
  reject(new TypeError("Failed to fetch"));
  await result;
  expect(submitted).toBe(true);
  expect(current()?.failure).toEqual({ message: "The network is unavailable.", temporary: true });
  expect(mergeMessagesWithPendingFollowUp([], current())).toEqual([
    expect.objectContaining({ role: "user", delivery: "unsent", parts: [{ type: "text", text: "Next turn" }] }),
  ]);
});

test("a queued follow-up leaves the conversation to the queued list", async () => {
  pending = null;
  const result = submission(
    {
      mutate: (_input, options) => {
        options.onSuccess({ status: "in_progress", followUp: { status: "queued", queue_position: 2 } });
      },
    },
    () => undefined,
  );
  await result;
  expect(current()).toBeNull();
});

test("an accepted question answer clears its pending submission without a new user turn", async () => {
  pending = null;
  const result = submission(
    {
      mutate: (_input, options) => {
        options.onSuccess({ status: "in_progress", followUp: { status: "dispatched" } });
      },
    },
    () => undefined,
    [["Blue"]],
  );
  await result;
  expect(current()).toBeNull();
});

test("a rejected question reply preserves the form for retry", async () => {
  pending = null;
  let submitted = false;
  const result = submission({
    mutate: (_input, options) => options.onError(new Error("Native reply rejected")),
  }, () => {
    submitted = true;
  }, [["Blue"]]);
  await expect(result).rejects.toThrow("Native reply rejected");
  expect(submitted).toBe(false);
  expect(current()?.failure).toBeDefined();
});

test("shows an accepted follow-up once while its run timestamp is still syncing", () => {
  pending = null;
  void submission({ mutate: () => undefined }, () => undefined);
  const accepted = [{ id: "accepted", role: "user" as const, parts: [{ type: "text" as const, text: "Next turn" }] }];
  expect(mergeMessagesWithPendingFollowUp(accepted, current())).toEqual(accepted);
});

test("assistant messages arriving during submission keep the pending user turn visible", () => {
  pending = null;
  void submission({ mutate: () => undefined }, () => undefined);
  const streaming = [
    { id: "streaming", role: "assistant" as const, parts: [{ type: "text" as const, text: "Still working" }] },
  ];
  expect(mergeMessagesWithPendingFollowUp(streaming, current())).toHaveLength(3);
  expect(mergeMessagesWithPendingFollowUp(streaming, current())[1].parts).toEqual([
    { type: "text", text: "Next turn" },
  ]);
});

test("another user turn does not acknowledge a different pending submission", () => {
  pending = null;
  void submission({ mutate: () => undefined }, () => undefined);
  const other = [{ id: "other", role: "user" as const, parts: [{ type: "text" as const, text: "A different turn" }] }];
  expect(mergeMessagesWithPendingFollowUp(other, current())).toHaveLength(3);
});

test("a session follow-up does not become work in a new draft", () => {
  pending = null;
  void submission({ mutate: () => undefined }, () => undefined);
  expect(shouldShowPendingFollowUp(current(), null)).toBe(false);
  expect(shouldShowPendingFollowUp(current(), "session-1")).toBe(true);
  expect(shouldShowPendingFollowUp(current(), "session-2")).toBe(false);
});
