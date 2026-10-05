import { expect, test } from "bun:test";
import { type CreateSessionMutation, submitSessionMessage } from "./session-chat-actions";
import type { PendingFollowUpState } from "./session-chat-state";

test.each([
  "accepted",
  "failed",
])("hands off a new draft immediately and waits for the %s response", async (outcome) => {
  let pending: PendingFollowUpState | null = null;
  let response!: Parameters<CreateSessionMutation["mutate"]>[1];
  let submitted = 0;
  const result = submitSessionMessage({
    sessionId: null,
    projectId: "project-1",
    agent: "codex",
    model: undefined,
    text: "Start here",
    attachments: [
      {
        file_id: "file-1",
        name: "notes.txt",
        mime_type: "text/plain",
        size_bytes: 1,
        hash: null,
        url: "/files/file-1",
        created_at: "2026-10-05",
        updated_at: "2026-10-05",
      },
    ],
    messages: [],
    pendingIdRef: { current: 0 },
    setPendingFollowUp: (next) => {
      pending = typeof next === "function" ? next(pending) : next;
    },
    createSession: {
      mutate: (_input, options) => {
        response = options;
      },
    },
    followUp: { mutate: () => undefined },
    reconnect: () => undefined,
    onSubmitted: () => {
      expect(pending).toMatchObject({ prompt: "Start here", attachments: [{ file_id: "file-1" }] });
      submitted += 1;
    },
  });
  expect(submitted).toBe(1);
  let settled = false;
  void result.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  if (outcome === "accepted") response.onSuccess({ sessionId: "session-1", status: "running" });
  else response.onError(new Error("Could not create session"));
  await result;
  expect(submitted).toBe(1);
});

test("keeps a new draft when no agent is selected", async () => {
  let submitted = false;
  await expect(
    submitSessionMessage({
      sessionId: null,
      projectId: "project-1",
      agent: null,
      model: undefined,
      text: "Start here",
      messages: [],
      pendingIdRef: { current: 0 },
      setPendingFollowUp: () => {
        throw new Error("No message should be added");
      },
      createSession: {
        mutate: () => {
          throw new Error("No request should start");
        },
      },
      followUp: { mutate: () => undefined },
      reconnect: () => undefined,
      onSubmitted: () => {
        submitted = true;
      },
    }),
  ).rejects.toThrow("Select a project and an agent before sending.");
  expect(submitted).toBe(false);
});
