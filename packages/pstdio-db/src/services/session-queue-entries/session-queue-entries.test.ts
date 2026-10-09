import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createSessionsDBService } from "../sessions/sessions";
import { createSessionQueueEntriesDBService } from "./session-queue-entries";

let close: () => Promise<void>;
let db: DbClient;
let projectId: string;
let queueService: ReturnType<typeof createSessionQueueEntriesDBService>;
let sessionsService: ReturnType<typeof createSessionsDBService>;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;
  const projectsService = createProjectsDBService(db);
  sessionsService = createSessionsDBService(db);
  queueService = createSessionQueueEntriesDBService(db);
  const project = await projectsService.create({ name: "test-project" });
  projectId = project.id;
});

afterEach(async () => {
  await close();
});

describe("session queue entries service", () => {
  test("pending deletion preserves a claimed follow-up until dispatch cleanup", async () => {
    const session = await sessionsService.create({ project_id: projectId, title: "follow-up", agent: "fake" });
    const pending = await queueService.create({ session_id: session.id, prompt: "pending", request_kind: "follow_up" });
    const claimed = await queueService.create({ session_id: session.id, prompt: "claimed", request_kind: "follow_up" });
    await queueService.markDispatchStarted(claimed.queue_position);

    expect(await queueService.removePending(pending.queue_position)).toBe(true);
    expect(await queueService.removePending(claimed.queue_position)).toBe(false);
    expect(await queueService.removePending(pending.queue_position)).toBe(false);
    expect(await queueService.listDispatchStarted()).toEqual([expect.objectContaining({ prompt: "claimed" })]);

    await queueService.remove(claimed.queue_position);
    expect(await queueService.listDispatchStarted()).toEqual([]);
  });

  test("lists entries in deterministic FIFO order", async () => {
    const first = await sessionsService.create({ project_id: projectId, title: "first", agent: "claude-code" });
    const second = await sessionsService.create({ project_id: projectId, title: "second", agent: "claude-code" });
    const createdAt = new Date().toISOString();

    await queueService.create({ session_id: first.id, prompt: "first", request_kind: "start", created_at: createdAt });
    await queueService.create({
      session_id: second.id,
      prompt: "second",
      request_kind: "start",
      created_at: createdAt,
    });

    const entries = await queueService.listPending();

    expect(entries.map((entry) => entry.session_id)).toEqual([first.id, second.id]);
  });

  test("rolls back both pending updates when the second swap write fails", async () => {
    const session = await sessionsService.create({
      project_id: projectId,
      title: "swap rollback",
      agent: "claude-code",
    });
    const first = await queueService.create({
      session_id: session.id,
      prompt: "first",
      request_kind: "follow_up",
    });
    const second = await queueService.create({
      session_id: session.id,
      prompt: "second",
      request_kind: "follow_up",
    });

    await expect(
      queueService.swapPending(first!.queue_position, { prompt: "second" }, second!.queue_position, {
        prompt: null as never,
      }),
    ).rejects.toThrow();

    const entries = await queueService.listPendingBySession(session.id);
    expect(entries.map((entry) => entry.prompt)).toEqual(["first", "second"]);
  });
});

test("saved execution settings survive session selection changes", async () => {
  const session = await sessionsService.create({
    project_id: projectId,
    title: "Settings",
    agent: "fake",
    last_selected_model: "first-model",
  });
  const entry = await sessionsService.insertEntryForActive({
    id: session.id,
    prompt: "Next",
    request_kind: "follow_up",
    model: "queued-model",
    params_json: { thinking: "high" },
  });
  await sessionsService.update(session.id, { last_selected_model: "other-model" });
  expect(await queueService.get(entry!.queue_position)).toMatchObject({
    model: "queued-model",
    params_json: { thinking: "high" },
  });
});

test("combining checks both saved revisions and commits the complete request together", async () => {
  const session = await sessionsService.create({ project_id: projectId, title: "Combine", agent: "fake" });
  const first = await queueService.create({
    session_id: session.id,
    prompt: "First",
    request_kind: "follow_up",
    model: "model",
    params_json: { thinking: "high" },
    attachments_json: [{ file_id: "a" }],
  });
  const second = await queueService.create({
    session_id: session.id,
    prompt: "Second",
    request_kind: "follow_up",
    model: "model",
    params_json: { thinking: "high" },
    attachments_json: [{ file_id: "b" }, { file_id: "a" }],
  });
  const combined = await queueService.combinePending({
    sessionId: session.id,
    sourcePosition: first.queue_position,
    targetPosition: second.queue_position,
    sourceRevision: first.revision,
    targetRevision: second.revision,
  });
  expect(combined).toMatchObject({
    prompt: "First\n\nSecond",
    model: "model",
    params_json: { thinking: "high" },
    attachments_json: [{ file_id: "b" }, { file_id: "a" }],
  });
  expect(combined!.revision).not.toBe(second.revision);
  expect(await queueService.listPendingBySession(session.id)).toEqual([combined!]);
});

test("stale, claimed, and incompatible combine participants preserve both requests", async () => {
  const session = await sessionsService.create({ project_id: projectId, title: "Combine guards", agent: "fake" });
  const first = await queueService.create({
    session_id: session.id,
    prompt: "First",
    request_kind: "follow_up",
    model: "one",
  });
  const second = await queueService.create({
    session_id: session.id,
    prompt: "Second",
    request_kind: "follow_up",
    model: "two",
  });
  const input = {
    sessionId: session.id,
    sourcePosition: first.queue_position,
    targetPosition: second.queue_position,
    sourceRevision: first.revision,
    targetRevision: second.revision,
  };
  expect(await queueService.combinePending(input)).toBeNull();
  const updated = await queueService.updatePending(second.queue_position, { model: "one" }, second.revision);
  expect(await queueService.combinePending(input)).toBeNull();
  await queueService.markDispatchStarted(first.queue_position);
  expect(await queueService.combinePending({ ...input, targetRevision: updated!.revision })).toBeNull();
  expect((await queueService.get(first.queue_position))!.prompt).toBe("First");
  expect((await queueService.get(second.queue_position))!.prompt).toBe("Second");
});

test("identical requests acquire new revisions on edits and reorder", async () => {
  const session = await sessionsService.create({ project_id: projectId, title: "Revisions", agent: "fake" });
  const first = await queueService.create({ session_id: session.id, prompt: "Same", request_kind: "follow_up" });
  const second = await queueService.create({ session_id: session.id, prompt: "Same", request_kind: "follow_up" });
  expect(first.revision).not.toBe(second.revision);
  await queueService.swapPending(first.queue_position, { prompt: "Same" }, second.queue_position, { prompt: "Same" });
  expect(await queueService.updatePending(first.queue_position, { prompt: "Stale" }, first.revision)).toBeNull();
  expect((await queueService.get(first.queue_position))!.prompt).toBe("Same");
});

test("queue discovery includes held and pending requests exactly once and excludes dispatched work", async () => {
  const session = await sessionsService.create({ project_id: projectId, title: "discovery", agent: "fake" });
  const pending = await queueService.create({ session_id: session.id, prompt: "pending", request_kind: "follow_up" });
  const held = await queueService.create({ session_id: session.id, prompt: "held", request_kind: "follow_up" });
  const dispatched = await queueService.create({
    session_id: session.id,
    prompt: "dispatched",
    request_kind: "follow_up",
  });
  await queueService.claimSteering(held.queue_position, held.revision, { id: "delivery", runStartedAt: "run" });
  await queueService.markDispatchStarted(dispatched.queue_position);
  expect((await queueService.listUndispatchedBySession(session.id)).map((entry) => entry.queue_position)).toEqual([
    pending.queue_position,
    held.queue_position,
  ]);
  await queueService.releaseSteering(held.queue_position, "delivery");
  expect((await queueService.listUndispatchedBySession(session.id)).map((entry) => entry.queue_position)).toEqual([
    pending.queue_position,
    held.queue_position,
  ]);
});
