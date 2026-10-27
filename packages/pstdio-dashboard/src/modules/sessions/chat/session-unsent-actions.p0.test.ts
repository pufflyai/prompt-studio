import { afterEach, expect, test } from "bun:test";
import { clearPendingFollowUp } from "./session-chat-actions";
import { createPendingFollowUpState, getPendingFollowUp, updatePendingFollowUp } from "./session-chat-state";
import { sessionUnsentActions } from "./session-unsent-actions";

const conversation = "unsent-retry";
const attachments = [
  {
    file_id: "file",
    name: "draft.txt",
    size_bytes: 8,
    mime_type: "text/plain",
    hash: null,
    url: "/draft.txt",
    created_at: "2026-10-26",
    updated_at: "2026-10-26",
  },
];
afterEach(() => updatePendingFollowUp(conversation, null));

test("a blocked retry preserves its unsent message and attachments", async () => {
  const pending = createPendingFollowUpState({
    prompt: "Keep this draft",
    pendingId: "original",
    messageCount: 0,
    attachments,
  });
  updatePendingFollowUp(conversation, pending);
  const actions = sessionUnsentActions(pending, {
    clear: () => clearPendingFollowUp(conversation, pending),
    send: async () => {
      throw Error("Sign in before sending");
    },
    restore: () => {
      throw Error("The unsent message should keep ownership");
    },
  });
  await actions.onRetry();
  expect(getPendingFollowUp(conversation)).toBe(pending);
  expect(getPendingFollowUp(conversation)?.attachments).toEqual(attachments);
});

test("a blocked question retry preserves its native response", async () => {
  const pending = {
    ...createPendingFollowUpState({ prompt: "Answer", pendingId: "question", messageCount: 0 }),
    questionResponse: { callId: "request", answers: [["Yes"]] },
  };
  updatePendingFollowUp(conversation, pending);
  await sessionUnsentActions(pending, {
    clear: () => clearPendingFollowUp(conversation, pending),
    send: async () => {
      throw Error("Account action is still running");
    },
    restore: () => {
      throw Error("A question response is not a plain draft");
    },
  }).onRetry();
  expect(getPendingFollowUp(conversation)).toBe(pending);
});

test("an accepted retry keeps the replacement submission's ownership", async () => {
  const pending = createPendingFollowUpState({ prompt: "Retry", pendingId: "old", messageCount: 0 });
  const replacement = createPendingFollowUpState({ prompt: "Retry", pendingId: "new", messageCount: 0 });
  updatePendingFollowUp(conversation, pending);
  await sessionUnsentActions(pending, {
    clear: () => clearPendingFollowUp(conversation, pending),
    send: async () => {
      updatePendingFollowUp(conversation, replacement);
    },
    restore: () => {},
  }).onRetry();
  expect(getPendingFollowUp(conversation)).toBe(replacement);
});
