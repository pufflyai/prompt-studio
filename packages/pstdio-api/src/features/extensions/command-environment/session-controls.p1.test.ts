import { afterAll, beforeAll, expect, test } from "bun:test";
import { createInvocationScope } from "pstdio-extensions";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { inertSessionChannelHooks } from "../../sessions/session-store.test-utils";
import { createSessionsApi } from "./sessions";

let handle: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  handle = await createTestApp({ harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("controls")]) });
});
afterAll(async () => handle.close());

const fixture = async () => {
  const project = await handle.deps.projectService.create({ name: "Session controls" });
  const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "SC" } });
  const session = await handle.deps.sessionService.create({
    project_id: project.id,
    title: "Session",
    agent: testHarnessId("controls"),
  });
  return { project, api, session };
};

test("extensions rename, archive, inspect activity, and delete inactive sessions", async () => {
  const { api, session } = await fixture();
  expect(await api.rename(session.id, " Renamed ")).toMatchObject({ title: "Renamed" });
  await expect(api.rename(session.id, "  ")).rejects.toThrow();
  await expect(api.delete(session.id)).rejects.toThrow("Stop active or queued work");
  await api.stop(session.id);
  expect(await api.archive(session.id)).toMatchObject({ archived: true });
  expect((await api.listActivity(session.id)).items).toContainEqual(
    expect.objectContaining({ eventType: "session_archived" }),
  );
  await api.delete(session.id);
  expect(await api.get(session.id)).toBeNull();
});

test("extensions read conversation snapshots and stream live messages without owning execution", async () => {
  const { api, session } = await fixture();
  const entry = handle.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
  const conversation = await entry.conversationReady;
  const message = { id: "message", role: "assistant" as const, parts: [{ type: "text" as const, text: "Hello" }] };
  conversation.push({ op: "add", path: "/messages/0", value: message });
  expect(await api.getConversation(session.id)).toMatchObject({ session: { id: session.id }, messages: [message] });
  expect(await api.getConversationSources(session.id)).toMatchObject({ checkpoint: null, native: null });
  const controller = new AbortController();
  const snapshot = Promise.withResolvers<void>();
  const patch = Promise.withResolvers<void>();
  const streaming = api.stream(
    session.id,
    async (event) => {
      if (event.event !== "patch") return;
      if (event.data.path === "/messages") snapshot.resolve();
      if (event.data.path === "/messages/1") patch.resolve();
    },
    { signal: controller.signal },
  );
  await snapshot.promise;
  conversation.push({ op: "add", path: "/messages/1", value: { ...message, id: "next" } });
  await patch.promise;
  controller.abort();
  await streaming;
  expect(handle.deps.sessionService.store.get(session.id)).toBe(entry);
  expect(entry.cancellationRequested).toBe(false);
  handle.deps.sessionService.store.remove(session.id);
});

test("extensions resolve pending tool approvals", async () => {
  const { api, session } = await fixture();
  const entry = handle.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
  const approval = entry.approvalService.requestApproval({
    id: "approval",
    toolName: "write",
    toolInput: {},
    toolUseId: "write",
  });
  await api.approve(session.id, { id: "approval", decision: "deny" });
  expect(await approval).toMatchObject({ decision: "deny" });
  handle.deps.sessionService.store.remove(session.id);
  await expect(api.approve(session.id, { id: "approval", decision: "approve" })).rejects.toThrow();
});

test("extension follow-ups deliver structured answers to the active native question", async () => {
  const { api, session } = await fixture();
  handle.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
  const answered: unknown[] = [];
  handle.deps.sessionService.store.setSession(session.id, {
    done: new Promise(() => {}),
    stop: () => {},
    replyQuestion: async (response) => {
      answered.push(response);
    },
  });
  await api.followup({ sessionId: session.id, questionResponse: { callId: "question", answers: [["Blue"]] } });
  expect(answered).toEqual([{ callId: "question", answers: [["Blue"]] }]);
  expect((await api.getQueuedFollowUps(session.id)).requests).toBeEmpty();
  handle.deps.sessionService.store.remove(session.id);
});

test("extensions remove and reorder pending follow-ups with revision guards", async () => {
  const { api, session } = await fixture();
  const service = handle.deps.sessionService;
  await service.insertEntryForActive({ id: session.id, prompt: "First", request_kind: "follow_up" });
  await service.insertEntryForActive({ id: session.id, prompt: "Second", request_kind: "follow_up" });
  const { requests } = await api.getQueuedFollowUps(session.id);
  const second = requests[1];
  await expect(
    api.moveQueuedFollowUp(session.id, second.queuePosition, { direction: "up", steps: 0 }),
  ).rejects.toThrow();
  const moved = await api.moveQueuedFollowUp(session.id, second.queuePosition, {
    direction: "up",
    expectedRevision: second.revision,
    expectedOrder: requests.map(({ queuePosition, revision }) => ({ queuePosition, revision })),
  });
  expect(moved.queuePosition).toBe(requests[0].queuePosition);
  expect((await api.getQueuedMessages(session.id)).messages).toHaveLength(2);
  await expect(api.removeQueuedFollowUp(session.id, moved.queuePosition, "stale")).rejects.toThrow();
  const updated = (await api.getQueuedFollowUps(session.id)).requests[0];
  expect(updated.prompt).toBe("Second");
  await api.removeQueuedFollowUp(session.id, updated.queuePosition, updated.revision);
  expect((await api.getQueuedFollowUps(session.id)).requests.map((request) => request.prompt)).toEqual(["First"]);
});

test("extensions upload, read, submit, and delete project session attachments", async () => {
  const { api } = await fixture();
  const attachment = await api.uploadAttachment({ name: "note.txt", data: new TextEncoder().encode("A note") });
  expect(new TextDecoder().decode(await api.readAttachment(attachment.fileId))).toBe("A note");
  await api.deleteAttachment(attachment.fileId);
  await expect(api.readAttachment(attachment.fileId)).rejects.toThrow();
  await expect(api.uploadAttachment({ name: "file.exe", data: new Uint8Array() })).rejects.toThrow();
});

test("session operations reject foreign sessions and cancelled invocations", async () => {
  const { api } = await fixture();
  const foreign = await fixture();
  const id = foreign.session.id;
  for (const action of [
    () => api.getConversation(id),
    () => api.getConversationSources(id),
    () => api.getQueuedMessages(id),
    () => api.rename(id, "Changed"),
    () => api.archive(id),
    () => api.delete(id),
    () => api.approve(id, { id: "a", decision: "approve" }),
    () => api.getHarnessCommands(id),
    () => api.invokeHarnessOperation(id, { kind: "command", text: "/help" }),
    () => api.removeQueuedFollowUp(id, 1),
    () => api.moveQueuedFollowUp(id, 1, { direction: "up" }),
    () => api.listActivity(id),
    () => api.stream(id, () => {}),
    () => api.retainResources(id),
  ])
    await expect(action()).rejects.toThrow("Session not found");
  const controller = new AbortController();
  const cancelled = createSessionsApi(handle.deps, {
    projectId: foreign.project.id,
    project: { ...foreign.project, shorthand: "F" },
    signal: controller.signal,
  });
  controller.abort();
  await expect(cancelled.rename(id, "Changed")).rejects.toThrow();
  await expect(cancelled.getConversation(id)).rejects.toThrow();
  await expect(cancelled.stream(id, () => {})).rejects.toThrow();
  expect((await foreign.api.get(id))?.title).toBe("Session");
});

test("extensions discover and invoke native commands before and after session creation", async () => {
  const calls: string[] = [];
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("commands", {
      provider: {
        getCommandState: () => ({ slashCommands: true, commands: [{ name: "/plan", description: "Plan" }], modes: [] }),
        prepareOperation: (_ctx, _input, operation) => ({
          execution: "exclusive",
          invoke: async () => {
            if (operation.kind === "command") calls.push(operation.text);
            return { kind: "completed", message: "Native result" };
          },
        }),
      },
    }),
  ]);
  const isolated = await createTestApp({ harnessRegistry: registry });
  try {
    const response = await isolated.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Native extension commands" })),
    });
    const project = await response.json();
    const api = createSessionsApi(isolated.deps, { projectId: project.id, project: { ...project, shorthand: "NC" } });
    const harness = { harnessId: testHarnessId("commands") };
    await expect(
      api.create({ title: "Mixed", harness, prompt: "Work", operation: { kind: "command", text: "/plan" } }),
    ).rejects.toThrow("cannot be combined");
    expect((await api.getDraftHarnessCommands({ harness })).commands[0].name).toBe("/plan");
    expect(await isolated.deps.sessionService.list(project.id)).toBeEmpty();
    const session = await api.create({ title: "Native", harness, operation: { kind: "command", text: "/plan" } });
    expect(session.operationResult).toEqual({ status: "completed", message: "Native result" });
    await api.stream(session.id, () => {});
    expect((await api.getHarnessCommands(session.id)).commands[0].name).toBe("/plan");
    await expect(
      api.invokeHarnessOperation(session.id, { kind: "command", text: "/plan" }, "outdated-harness"),
    ).rejects.toThrow("harness changed");
    expect(await api.invokeHarnessOperation(session.id, { kind: "command", text: "/plan" }, harness.harnessId)).toEqual(
      { status: "completed", message: "Native result" },
    );
    expect(calls).toEqual(["/plan", "/plan"]);
    await api.stream(session.id, () => {});
  } finally {
    await isolated.close();
  }
});

test("extensions resolve native identities only in their project and apply status transitions", async () => {
  const { api, session } = await fixture();
  const foreign = await fixture();
  for (const id of [session.id, foreign.session.id])
    await handle.deps.sessionService.update(id, {
      agent_session_id: "native-shared",
      params_json: { thinking: "high" },
    });
  expect(await api.get(session.id)).toMatchObject({ agentSessionId: "native-shared", params: { thinking: "high" } });
  expect(await api.resolveSessionId({ harnessId: testHarnessId("controls"), agentSessionId: "native-shared" })).toBe(
    session.id,
  );
  expect(await api.resolveSessionId({ harnessId: testHarnessId("controls"), agentSessionId: "missing" })).toBeNull();
  expect(await api.updateStatus(session.id, "awaiting_input")).toMatchObject({ status: "awaiting_input" });
  expect(await api.updateStatus(session.id, "cancelled")).toMatchObject({ status: "cancelled" });
  expect((await api.get(session.id))?.lastExit?.cause).toBe("user_stop");
});

test("session attachment access rejects foreign files and preserves submitted files", async () => {
  const { api, session } = await fixture();
  const foreign = await fixture();
  const attachment = await api.uploadAttachment({ name: "note.txt", data: new TextEncoder().encode("A note") });
  await expect(foreign.api.readAttachment(attachment.fileId)).rejects.toThrow("not found");
  await expect(foreign.api.deleteAttachment(attachment.fileId)).rejects.toThrow("not found");
  await handle.deps.sessionService.insertEntryForActive({
    id: session.id,
    prompt: "Read",
    request_kind: "follow_up",
    attachments_json: [{ file_id: attachment.fileId }],
  });
  await expect(api.deleteAttachment(attachment.fileId)).rejects.toThrow("already submitted");
});

test("ending an invocation stops its stream without stopping the session", async () => {
  const { project, session } = await fixture();
  const controller = new AbortController();
  const scope = createInvocationScope({ parent: controller.signal, logger: { info() {}, warn() {}, error() {} } });
  const api = createSessionsApi(handle.deps, {
    projectId: project.id,
    project: { ...project, shorthand: "SC" },
    signal: scope.signal,
    scope,
  });
  const entry = handle.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
  const ready = Promise.withResolvers<void>();
  const subscription = api.stream(session.id, (event) => {
    if (event.event === "patch") ready.resolve();
  });
  await ready.promise;
  const retained = await api.retainResources(session.id);
  await scope.close();
  expect(scope.signal.aborted).toBe(false);
  await subscription;
  retained.close();
  expect(handle.deps.sessionService.store.get(session.id)).toBe(entry);
  expect(entry.cancellationRequested).toBe(false);
  handle.deps.sessionService.store.remove(session.id);
});
