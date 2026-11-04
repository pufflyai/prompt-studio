import { expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DeviceCommand, HarnessExit } from "pstdio-api-contracts";
import { jsonSchema } from "pstdio-sync-contracts";
import { nativeAccountFile } from "../../services/account/native-account";
import { createNativeStore } from "../../services/account/native-store";
import { createPersonalHistoryStore } from "../../services/personal-history/store";
import { withDeviceCommandAttachments } from "../../services/relay/device-command-attachments";
import { createDeviceCommandExecutor } from "../../services/relay/device-command-executor";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { inertSessionChannelHooks } from "./session-store.test-utils";

const verifyUncertainSubmissionCleanup = async (input: {
  source: Awaited<ReturnType<typeof createTestApp>>;
  target: Awaited<ReturnType<typeof createTestApp>>;
  execute: ReturnType<typeof createDeviceCommandExecutor>;
  projectId: string;
  workspaceId: string;
  fileId: string;
}) => {
  const { source, target, execute, projectId, workspaceId, fileId } = input;
  const command: Extract<DeviceCommand, { type: "session.create" }> = {
    type: "session.create",
    input: {
      projectId,
      workspaceId,
      agent: testHarnessId("remote"),
      title: "Uncertain submission",
      attachments: [{ fileId }],
    },
  };
  const loseReply = async (value: DeviceCommand) => {
    await execute(jsonSchema.parse(JSON.parse(JSON.stringify(value))), { signal: new AbortController().signal });
    throw new Error("Lost acknowledgement");
  };
  await expect(
    withDeviceCommandAttachments(
      source.deps,
      projectId,
      { ...command, input: { ...command.input, agent: "missing.harness" } },
      loseReply,
    ),
  ).rejects.toThrow("Lost acknowledgement");
  expect(await target.deps.fileService.get(fileId)).toBeNull();
  expect(await source.deps.fileService.get(fileId)).not.toBeNull();

  const cancelled = new AbortController();
  const actions: string[] = [];
  const upload = target.deps.fileService.upload;
  const importing = spyOn(target.deps.fileService, "upload").mockImplementation(async (...args) => {
    const file = await upload(...args);
    cancelled.abort(new Error("User cancelled before dispatch"));
    return file;
  });
  try {
    await expect(
      withDeviceCommandAttachments(source.deps, projectId, command, async (value) => {
        cancelled.signal.throwIfAborted();
        actions.push(value.type);
        return execute(jsonSchema.parse(JSON.parse(JSON.stringify(value))), { signal: cancelled.signal });
      }),
    ).rejects.toThrow("User cancelled before dispatch");
  } finally {
    importing.mockRestore();
  }
  expect(actions).toEqual(["session.create"]);
  expect(await target.deps.fileService.get(fileId)).toBeNull();

  // A lost final reply must retain files that the target already submitted successfully.
  await expect(withDeviceCommandAttachments(source.deps, projectId, command, loseReply)).rejects.toThrow(
    "Lost acknowledgement",
  );
  expect(await target.deps.fileService.get(fileId)).not.toBeNull();
  const unrelatedId = crypto.randomUUID();
  const unrelated = await execute(
    jsonSchema.parse({
      ...command,
      attachmentContents: [{ fileId: unrelatedId, name: "extra.txt", mimeType: "text/plain", data: "ZXh0cmE=" }],
    }),
    { signal: new AbortController().signal },
  );
  expect(unrelated).toMatchObject({ status: 400 });
  expect(await target.deps.fileService.get(unrelatedId)).toBeNull();
};

test("the normal session API sends follow-ups, question answers, approvals and interrupts to their owning device", async () => {
  const root = await mkdtemp(join(tmpdir(), "remote-session-actions-"));
  const source = await createTestApp({ storageRoot: join(root, "source") });
  const target = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("remote")]),
  });
  try {
    const project = await target.deps.projectService.create({ name: "Shared" });
    await source.deps.projectService.create({ id: project.id, name: project.name });
    const { environmentId: sourceId } = await source.deps.environmentService.get();
    const { environmentId: targetId } = await target.deps.environmentService.get();
    const login = {
      accountId: "owner",
      deviceId: sourceId,
      token: "fixture-device-credential",
      managerOrigin: "https://127.0.0.1:1",
      relayOrigin: "https://127.0.0.1:1",
    };
    await createNativeStore(nativeAccountFile(":memory:", join(root, "source"))).save(login);
    await source.deps.personalHistoryService.refreshIdentity();
    const session = await target.deps.sessionService.create({
      project_id: project.id,
      title: "Remote",
      agent: testHarnessId("remote"),
    });
    const entry = target.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
    let stops = 0;
    const answers: unknown[] = [];
    target.deps.sessionService.store.setSession(
      session.id,
      {
        agentSessionId: "native",
        done: new Promise<HarnessExit>(() => {}),
        stop: () => {
          stops++;
        },
        replyQuestion: async (response) => {
          answers.push(response);
        },
      },
      entry,
    );
    const history = createPersonalHistoryStore({
      ...login,
      projectId: project.id,
      documents: source.deps.extensionStorageService.documents,
      files: source.deps.personalHistoryService.logs,
    });
    await history.writeRecords("sessions", { id: targetId, ownerId: login.accountId, name: "Desktop" }, [
      { ...session, workspace_id: null },
    ]);
    const folder = join(root, "target-files");
    await mkdir(folder);
    await Bun.write(join(folder, "note.md"), "Only the target device has this file.");
    const workspace = await target.deps.workspaceService.createStandalone({
      project_id: project.id,
      name: "Remote files",
      root_path: folder,
    });
    await history.writeRecords("workspaces", { id: targetId, ownerId: login.accountId, name: "Desktop" }, [workspace]);
    const execute = createDeviceCommandExecutor(target.deps, project.id);
    source.deps.accountService.start(
      async () => {},
      async () => ({ state: "synced", offlineReady: true }),
      async () => {},
      async () => {},
      async (projectId, deviceId, command, signal) => {
        expect([projectId, deviceId]).toEqual([project.id, targetId]);
        const send = (command: Parameters<typeof withDeviceCommandAttachments>[2]) =>
          execute(jsonSchema.parse(JSON.parse(JSON.stringify(command))), { signal });
        return withDeviceCommandAttachments(source.deps, projectId, command, send);
      },
    );
    const request = (suffix: string, body: unknown, method = "POST") =>
      source.app.request(`/v1/sessions/${session.id}/${suffix}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const followUp = await request("follow-up", { prompt: "Keep working" });
    expect(followUp.status).toBe(200);
    expect(await followUp.json()).toMatchObject({
      id: session.id,
      device: { id: targetId },
      followUp: { status: "queued" },
    });
    expect(await target.deps.sessionQueueEntriesService.listUndispatched()).toEqual(
      expect.arrayContaining([expect.objectContaining({ session_id: session.id, prompt: "Keep working" })]),
    );
    const uploaded = await source.app.request(`/v1/projects/${project.id}/session-attachments`, {
      method: "POST",
      headers: { "x-file-name": "context.txt", "content-type": "text/plain" },
      body: "Source attachment bytes",
    });
    expect(uploaded.status).toBe(201);
    const attachment = await uploaded.json();
    expect(await target.deps.fileService.get(attachment.fileId)).toBeNull();
    const withFile = await request("follow-up", {
      prompt: "Read this",
      attachments: [{ fileId: attachment.fileId }, { fileId: attachment.fileId }],
    });
    expect(withFile.status).toBe(200);
    expect(await target.deps.fileService.get(attachment.fileId)).toMatchObject({
      project_id: project.id,
      file_kind: "session_attachment",
    });
    const copied = await target.app.request(
      `/v1/projects/${project.id}/session-attachments/${attachment.fileId}/content`,
    );
    expect(await copied.text()).toBe("Source attachment bytes");
    const answered = await request("follow-up", {
      prompt: "Blue",
      questionResponse: { callId: "question", answers: [["Blue"]] },
    });
    expect(answered.status).toBe(200);
    expect(answers).toEqual([{ callId: "question", answers: [["Blue"]] }]);
    const approval = entry.approvalService.requestApproval({
      id: "approval",
      toolName: "shell",
      toolUseId: "shell-call",
      toolInput: { command: "pwd" },
    });
    expect((await request("approve", { id: "approval", decision: "approve" })).status).toBe(200);
    expect(await approval).toEqual({ id: "approval", decision: "approve" });
    expect((await request("status", { status: "cancelled" }, "PATCH")).status).toBe(200);
    expect(stops).toBe(1);
    expect(await target.deps.sessionService.get(session.id)).toMatchObject({ status: "cancelled" });
    expect(await source.deps.sessionService.get(session.id)).toBeNull();
    const created = await source.app.request(`/v1/account/projects/${project.id}/devices/${targetId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "session.create",
        input: {
          projectId: project.id,
          title: "Remote workspace shorthand",
          agent: testHarnessId("remote"),
          workspaceId: workspace.workspace_shorthand,
        },
      }),
    });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({ status: 201, body: { workspace_id: workspace.id } });
    const unused = await source.app.request(`/v1/projects/${project.id}/session-attachments`, {
      method: "POST",
      headers: { "x-file-name": "unused.txt", "content-type": "text/plain" },
      body: "Discard on rejection",
    });
    const unusedFile = await unused.json();
    const rejected = await source.app.request(`/v1/account/projects/${project.id}/devices/${targetId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "session.create",
        input: {
          projectId: project.id,
          title: "Rejected remote creation",
          agent: "not-installed",
          workspaceId: workspace.id,
          attachments: [{ fileId: unusedFile.fileId }],
        },
      }),
    });
    expect(await rejected.json()).toMatchObject({ status: 400 });
    expect(await target.deps.fileService.get(unusedFile.fileId)).toBeNull();
    expect(await source.deps.fileService.get(unusedFile.fileId)).not.toBeNull();
    expect(await target.deps.fileService.get(attachment.fileId)).not.toBeNull();
    await verifyUncertainSubmissionCleanup({
      source,
      target,
      execute,
      projectId: project.id,
      workspaceId: workspace.id,
      fileId: unusedFile.fileId,
    });
    const files = await source.app.request(`/v1/workspaces/${workspace.id}/files`);
    expect(files.status).toBe(200);
    expect(await files.json()).toMatchObject({ entries: [{ name: "note.md" }] });
    const file = await source.app.request(`/v1/workspaces/${workspace.id}/file?path=note.md`);
    expect(file.status).toBe(200);
    expect(await file.json()).toMatchObject({ content: "Only the target device has this file.", editable: false });
    expect((await source.app.request(`/v1/workspaces/${workspace.id}/file?path=../outside`)).status).toBe(400);
  } finally {
    await source.close();
    await target.close();
    await rm(root, { recursive: true, force: true });
  }
});
