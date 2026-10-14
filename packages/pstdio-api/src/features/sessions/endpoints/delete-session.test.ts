import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createTestHarnessRegistry, testHarnessId } from "../../harnesses/test-harness-registry";
import { checkpointConversation } from "../session-checkpoint";
import { createSessionScheduler } from "../session-scheduler";

let app: Awaited<ReturnType<typeof createTestApp>>;
let projectId: string;
beforeEach(async () => {
  app = await createTestApp({ harnessRegistry: createTestHarnessRegistry([]) });
  projectId = (await app.deps.projectService.create({ name: "Session removal" })).id;
});
afterEach(async () => app.close());
const create = (status: "completed" | "in_progress" | "awaiting_input" | "queued" = "completed") =>
  app.deps.sessionService.create({
    project_id: projectId,
    title: "Conversation",
    agent: testHarnessId("fake"),
    status,
  });
const remove = (id: string) => app.app.request(`/v1/sessions/${id}`, { method: "DELETE" });

test("deletes an inactive session, its workspace joins and anchors, and publishes the committed removal", async () => {
  const workspace = await app.deps.workspaceService.ensureDefault({
    project_id: projectId,
    name: "Project",
    branch: "main",
    root_path: "/tmp/session-removal",
  });
  const session = await create();
  const other = await create();
  await app.deps.workspaceSessionService.link(workspace.id, session.id);
  await app.deps.sessionService.addAnchors(session.id, [{ type: "workspace", id: workspace.id }]);
  await app.deps.sessionService.addAnchors(other.id, [{ type: "session", id: session.id }]);
  await app.deps.workspaceService.addAnchors(workspace.id, [{ type: "session", id: session.id }]);
  const file = await app.deps.fileService.upload({
    project_id: projectId,
    file_name: "session-messages.json",
    file_kind: "session_messages",
    data: Buffer.from("[]"),
  });
  await app.deps.sessionService.update(session.id, { session_file_id: file.id });
  const events: Array<{ table: string; op: string; data: unknown }> = [];
  const stop = app.deps.eventBus.subscribe((event) => events.push(event));
  const response = await remove(session.id);
  expect(response.status).toBe(204);
  expect(await app.deps.sessionService.get(session.id)).toBeNull();
  expect(await app.deps.workspaceSessionService.listByWorkspace(workspace.id)).toEqual([]);
  expect((await app.deps.sessionService.get(other.id))?.anchors_json).toEqual([]);
  expect(await app.deps.workspaceService.get(workspace.id)).not.toBeNull();
  expect(await app.deps.fileService.get(file.id)).toBeNull();
  expect(existsSync(file.storage_path)).toBe(false);
  expect(events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ table: "sessions", op: "delete", data: { id: session.id } }),
      expect.objectContaining({ table: "workspace_sessions", op: "delete" }),
      expect.objectContaining({
        table: "workspaces",
        op: "set",
        data: expect.objectContaining({ id: workspace.id, anchors_json: [] }),
      }),
      expect.objectContaining({
        table: "resource_anchor_events",
        data: expect.objectContaining({ operation: "remove" }),
      }),
      expect.objectContaining({
        table: "resource_events",
        data: expect.objectContaining({
          resource: expect.objectContaining({ type: "session", id: session.id, projectId }),
        }),
      }),
    ]),
  );
  stop();
  expect((await remove(session.id)).status).toBe(404);
});

test("a checkpoint cleanup error rolls back session data and publishes no removal", async () => {
  const session = await create();
  const file = await app.deps.fileService.upload({
    project_id: projectId,
    file_name: "history.json",
    file_kind: "session_messages",
    data: Buffer.from("[]"),
  });
  await app.deps.sessionService.update(session.id, { session_file_id: file.id });
  // A real storage error: the checkpoint path is a directory, not a readable file.
  unlinkSync(file.storage_path);
  mkdirSync(file.storage_path);
  const removals: unknown[] = [];
  const stop = app.deps.eventBus.subscribe((event) => {
    if (event.op === "delete" || event.table === "resource_events") removals.push(event);
  });
  expect((await remove(session.id)).status).toBe(500);
  expect((await app.deps.sessionService.get(session.id))?.session_file_id).toBe(file.id);
  expect(await app.deps.fileService.get(file.id)).not.toBeNull();
  expect(removals).toEqual([]);
  stop();
});

test("an inactive session with a failed checkpoint and retained history can still be deleted", async () => {
  const session = await create();
  const file = await app.deps.fileService.upload({
    project_id: projectId,
    file_name: "history.json",
    file_kind: "session_messages",
    data: Buffer.from("[]"),
  });
  await app.deps.sessionService.update(session.id, { session_file_id: file.id });
  const entry = app.deps.sessionService.store.create(session.id, {
    onApprovalRequest: () => {},
    onQuestionAsked: () => {},
    onQuestionAnswered: () => {},
  });
  unlinkSync(file.storage_path);
  mkdirSync(file.storage_path);
  await expect(checkpointConversation(session.id, entry, app.deps)).rejects.toThrow();
  expect((await entry.conversationReady).closed).toBe(true);
  expect(entry.checkpointPromise).toBeUndefined();
  rmSync(file.storage_path, { recursive: true });
  writeFileSync(file.storage_path, "[]");
  await app.deps.sessionQueueEntriesService.createDispatchStarted({
    session_id: session.id,
    prompt: "Accepted turn",
    request_kind: "start",
  });
  expect((await remove(session.id)).status).toBe(204);
  expect(app.deps.sessionService.store.get(session.id)).toBeNull();
  expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
});

test("retained run ownership blocks deletion while a terminal run finishes checkpointing", async () => {
  const session = await create();
  app.deps.sessionService.store.create(session.id, {
    onApprovalRequest: () => {},
    onQuestionAsked: () => {},
    onQuestionAnswered: () => {},
  });
  expect((await remove(session.id)).status).toBe(409);
  app.deps.sessionService.store.remove(session.id);
  expect((await remove(session.id)).status).toBe(204);
});

test("deletion and a competing follow-up share the lifecycle lock", async () => {
  const session = await create();
  const scheduler = createSessionScheduler(app.deps);
  const [deletion, followUp] = await Promise.allSettled([
    remove(session.id),
    scheduler.startOrQueueExisting({ session, prompt: "Competing turn" }),
  ]);
  if (deletion.status !== "fulfilled") throw deletion.reason;
  if (deletion.value.status === 204) {
    expect(followUp.status).toBe("rejected");
    expect(await app.deps.sessionService.get(session.id)).toBeNull();
  } else {
    expect(deletion.value.status).toBe(409);
    expect(followUp.status).toBe("fulfilled");
    expect(await app.deps.sessionService.get(session.id)).not.toBeNull();
  }
});

test("preserves a checkpoint shared with another session and unrelated attachments", async () => {
  const session = await create();
  const other = await create();
  const file = await app.deps.fileService.upload({
    project_id: projectId,
    file_name: "history.json",
    file_kind: "session_messages",
    data: Buffer.from("[]"),
  });
  const attachment = await app.deps.fileService.upload({
    project_id: projectId,
    file_name: "notes.txt",
    file_kind: "session_attachment",
    data: Buffer.from("keep"),
  });
  await app.deps.sessionService.update(session.id, { session_file_id: file.id });
  await app.deps.sessionService.update(other.id, { session_file_id: file.id });
  expect((await remove(session.id)).status).toBe(204);
  expect(await app.deps.fileService.get(file.id)).not.toBeNull();
  expect(existsSync(file.storage_path)).toBe(true);
  expect(await app.deps.fileService.get(attachment.id)).not.toBeNull();
});

test("rejects active, awaiting-input, queued, and pending work without losing data or publishing removal", async () => {
  for (const status of ["in_progress", "awaiting_input", "queued"] as const) {
    const session = await create(status);
    expect((await remove(session.id)).status).toBe(409);
    expect((await app.deps.sessionService.get(session.id))?.status).toBe(status);
  }
  const session = await create();
  await app.deps.sessionQueueEntriesService.create({
    session_id: session.id,
    prompt: "Next turn",
    request_kind: "follow_up",
  });
  expect((await remove(session.id)).status).toBe(409);
  expect(await app.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toHaveLength(1);
});

test("a stale follow-up cannot dispatch or recreate a deleted session", async () => {
  const session = await create();
  expect((await remove(session.id)).status).toBe(204);
  await expect(
    createSessionScheduler(app.deps).startOrQueueExisting({ session, prompt: "stale follow-up" }),
  ).rejects.toThrow("Session not found");
  expect(app.deps.sessionService.store.get(session.id)).toBeNull();
  expect(await app.deps.sessionService.get(session.id)).toBeNull();
});
