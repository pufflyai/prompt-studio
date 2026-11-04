import { expect } from "bun:test";
import type { createClient } from "@pstdio/sdk/client";
import type { ApprovalRequest, JsonPatch } from "pstdio-api-contracts";
import type { createDeviceCommandPolling } from "./packaged-device-command-polling";

type Client = ReturnType<typeof createClient>;
type WaitFor = ReturnType<typeof createDeviceCommandPolling>["waitFor"];

export const verifyEncryptedQuestion = async (from: Client, on: Client, sessionId: string, waitFor: WaitFor) => {
  await waitFor(
    "the remote turn to ask its question",
    async () => (await on.sessions.get(sessionId)).status === "awaiting_input",
  );
  const answered = await from.sessions.followUp(sessionId, {
    prompt: "Blue",
    questionResponse: { callId: "remote-question", answers: [["Blue"]] },
  });
  expect(answered.followUp.status).toBe("dispatched");
  await waitFor("the answer to reach the existing target turn", async () =>
    (await on.sessions.getConversation(sessionId)).messages.some((message) => message.id === "question-answer"),
  );
  const answer = (await on.sessions.getConversation(sessionId)).messages.find(
    (message) => message.id === "question-answer",
  )!;
  const text = answer.parts.find((part) => part.type === "text");
  expect(text?.type).toBe("text");
  if (text?.type !== "text") throw new Error("Target question response missing");
  expect(JSON.parse(text.text.slice("Question answered: ".length))).toEqual({
    callId: "remote-question",
    answers: [["Blue"]],
  });
};

export const verifyEncryptedWorkspaceFile = async (
  from: Client,
  on: Client,
  projectId: string,
  targetId: string,
  targetRoot: string,
  waitFor: WaitFor,
) => {
  // The normal query includes other devices' defaults, sorted by immutable ID.
  const workspace = (await on.workspaces.query(projectId)).items.find((row) => row.isDefault && !row.device)!;
  expect(workspace).toBeDefined();
  expect(workspace.rootPath).toBe(targetRoot);
  await waitFor("the target workspace to replicate to the source", async () =>
    (await from.workspaces.query(projectId)).items.some((row) => row.id === workspace.id),
  );
  expect((await from.workspaces.query(projectId)).items.find((row) => row.id === workspace.id)?.device?.id).toBe(
    targetId,
  );
  expect((await from.workspaces.listFiles(workspace.id)).entries).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: "target-note.md" })]),
  );
  expect(await from.workspaces.readFile(workspace.id, "target-note.md")).toMatchObject({
    content: "Private target file content.\n",
    editable: false,
  });
};

export const verifyEncryptedApproval = async (
  from: Client,
  on: Client,
  sessionId: string,
  unrelatedId: string,
  targetId: string,
  waitFor: WaitFor,
) => {
  const resumed = await from.sessions.followUp(sessionId, { prompt: "Require approval" });
  expect(resumed.followUp.status).toBe("dispatched");
  expect(resumed.lastRequestStarted).not.toBeNull();
  await waitFor("the resumed target to replicate", async () => {
    const shared = await from.sessions.get(sessionId);
    return shared.status === "in_progress" && shared.lastRequestStarted === resumed.lastRequestStarted;
  });
  let pendingApprovals: ApprovalRequest[] = [];
  const streamErrors: unknown[] = [];
  const stream = from.sessions.connectStream(sessionId, {
    onPatch: (data) => {
      const patch = data as JsonPatch;
      if (patch.path === "/approval_requests") pendingApprovals = patch.value as ApprovalRequest[];
    },
    onError: (error) => streamErrors.push(error),
  });
  try {
    await waitFor("the approval to reach the source stream", async () => {
      if (streamErrors.length) throw streamErrors[0];
      return pendingApprovals.some((request) => request.id === "remote-approval");
    });
    expect(pendingApprovals).toContainEqual({
      id: "remote-approval",
      toolName: "shell",
      toolUseId: "remote-shell",
      toolInput: { command: "private approval fixture" },
    });
    await from.sessions.approve(sessionId, { id: "remote-approval", decision: "approve" });
    await waitFor("the approval response to reach its target turn", async () =>
      JSON.stringify((await on.sessions.getConversation(sessionId)).messages).includes("Approval answered: approve"),
    );
    await waitFor("the resolved approval snapshot", async () => pendingApprovals.length === 0);
    expect((await from.sessions.get(sessionId)).device?.id).toBe(targetId);
    expect((await on.sessions.get(unrelatedId)).status).toBe("in_progress");
    await from.sessions.updateStatus(sessionId, "cancelled");
  } finally {
    stream.close();
  }
};
