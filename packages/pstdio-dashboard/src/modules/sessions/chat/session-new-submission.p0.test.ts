import { expect, test } from "bun:test";
import { type CreateSessionMutation, submitSessionMessage } from "./session-chat-actions";
import { getPendingFollowUp } from "./session-chat-state";

type CreateSessionResult = Awaited<ReturnType<CreateSessionMutation["mutateAsync"]>>;

test.each([
  "accepted",
  "failed",
])("hands off a new draft immediately and waits for the %s response", async (outcome) => {
  const conversationKey = `draft-${outcome}`;
  let resolve!: (result: CreateSessionResult) => void;
  let reject!: (error: Error) => void;
  const response = new Promise<CreateSessionResult>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  let submitted = 0;
  const result = submitSessionMessage({
    conversationKey,
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
    createSession: { mutateAsync: () => response },
    followUp: { mutateAsync: () => Promise.reject(new Error("Must create a session")) },
    reconnect: () => undefined,
    refreshQueue: async () => undefined,
    onSubmitted: () => {
      expect(getPendingFollowUp(conversationKey)).toMatchObject({
        prompt: "Start here",
        attachments: [{ file_id: "file-1" }],
      });
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
  if (outcome === "accepted") resolve({ sessionId: `session-${outcome}`, status: "running" });
  else reject(new Error("Could not create session"));
  await result;
  expect(submitted).toBe(1);
  if (outcome === "failed") expect(getPendingFollowUp(conversationKey)?.failure).toBeDefined();
});

test("keeps a new draft when no agent is selected", async () => {
  let submitted = false;
  await expect(
    submitSessionMessage({
      conversationKey: "draft-no-agent",
      sessionId: null,
      projectId: "project-1",
      agent: null,
      model: undefined,
      text: "Start here",
      messages: [],
      createSession: {
        mutateAsync: () => {
          throw new Error("No request should start");
        },
      },
      followUp: { mutateAsync: () => Promise.reject(new Error("Must create a session")) },
      reconnect: () => undefined,
      refreshQueue: async () => undefined,
      onSubmitted: () => {
        submitted = true;
      },
    }),
  ).rejects.toThrow("Select a project and an agent before sending.");
  expect(submitted).toBe(false);
  expect(getPendingFollowUp("draft-no-agent")).toBeNull();
});

test("a selected remote device owns only new session creation", async () => {
  const created: unknown[] = [];
  const followed: unknown[] = [];
  const input = {
    conversationKey: "remote-draft",
    sessionId: null,
    projectId: "project",
    agent: "remote-harness",
    model: undefined,
    deviceId: "laptop",
    workspaceId: "target-workspace",
    text: "Start on laptop",
    messages: [],
    createSession: {
      mutateAsync: async (value: unknown) => {
        created.push(value);
        return { sessionId: "remote-session", status: "queued" };
      },
    },
    followUp: {
      mutateAsync: async (value: unknown) => {
        followed.push(value);
        return { status: "queued" };
      },
    },
    reconnect: () => {},
    refreshQueue: async () => undefined,
  };
  await submitSessionMessage(input);
  expect(created).toEqual([expect.objectContaining({ deviceId: "laptop", workspaceId: "target-workspace" })]);
  await submitSessionMessage({ ...input, sessionId: "remote-session", deviceId: "other-device" });
  expect(followed).toEqual([expect.objectContaining({ sessionId: "remote-session" })]);
  expect(followed[0]).not.toHaveProperty("deviceId");
  expect(created).toHaveLength(1);
});
