import { expect, test } from "bun:test";
import { type FollowUpMutation, submitSessionMessage } from "./session-chat-actions";

const submission = (followUp: FollowUpMutation, onSubmitted: () => void) =>
  submitSessionMessage({
    sessionId: "session-1",
    projectId: "project-1",
    agent: "codex",
    model: "model-1",
    text: "Next turn",
    messages: [],
    pendingIdRef: { current: 0 },
    setPendingFollowUp: () => undefined,
    createSession: {
      mutate: () => {
        throw new Error("Must use existing session");
      },
    },
    followUp,
    reconnect: () => undefined,
    onSubmitted,
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

test("reports a failed submission without clearing the draft", async () => {
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
  expect(result).toBeInstanceOf(Promise);
  reject();
  await expect(result).rejects.toThrow();
  expect(submitted).toBe(false);
});
