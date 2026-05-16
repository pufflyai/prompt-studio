import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createSessionQueueEntriesDBService } from "../session-queue-entries/session-queue-entries";
import { createSessionsDBService } from "./sessions";

let db: DbClient;
let close: () => Promise<void>;
let sessionsService: ReturnType<typeof createSessionsDBService>;
let projectsService: ReturnType<typeof createProjectsDBService>;
let projectId: string;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;
  sessionsService = createSessionsDBService(db);
  projectsService = createProjectsDBService(db);

  const project = await projectsService.create({ name: "test-project" });
  projectId = project.id;
});

afterEach(async () => {
  await close();
});

describe("sessions service", () => {
  test("creates a session", async () => {
    const session = await sessionsService.create({
      project_id: projectId,
      title: "Test session",
      agent: "claude-code",
      last_selected_model: "claude-code-fast",
    });

    expect(session.id).toBeDefined();
    expect(session.title).toBe("Test session");
    expect(session.status).toBe("in_progress");
    expect(session.agent).toBe("claude-code");
    expect(session.last_selected_model).toBe("claude-code-fast");
    expect(session.project_id).toBe(projectId);
    expect(session.archived).toBe(false);
  });

  test("gets a session by id", async () => {
    const created = await sessionsService.create({
      project_id: projectId,
      title: "Get me",
      agent: "claude-code",
    });

    const fetched = await sessionsService.get(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.title).toBe("Get me");
  });

  test("returns null for unknown id", async () => {
    const fetched = await sessionsService.get("nonexistent");
    expect(fetched).toBeNull();
  });

  test("lists sessions for a project", async () => {
    await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });
    await sessionsService.create({ project_id: projectId, title: "S2", agent: "opencode" });

    const list = await sessionsService.list(projectId);
    expect(list).toHaveLength(2);
  });

  test("list excludes archived sessions by default", async () => {
    const session = await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });
    await sessionsService.archive(session.id);

    const list = await sessionsService.list(projectId);
    expect(list).toHaveLength(0);
  });

  test("list includes archived sessions when requested", async () => {
    const session = await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });
    await sessionsService.archive(session.id);

    const list = await sessionsService.list(projectId, { includeArchived: true });
    expect(list).toHaveLength(1);
  });

  test("list filters by status", async () => {
    await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });
    const s2 = await sessionsService.create({ project_id: projectId, title: "S2", agent: "claude-code" });
    await sessionsService.updateStatus(s2.id, "completed");

    const list = await sessionsService.list(projectId, { status: "completed" });
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("S2");
  });

  test("persists queued session status", async () => {
    const session = await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });
    const updated = await sessionsService.updateStatus(session.id, "queued");

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("queued");

    const list = await sessionsService.list(projectId, { status: "queued" });
    expect(list.map((row) => row.id)).toEqual([session.id]);
  });

  test("counts only running or awaiting input sessions as active", async () => {
    await sessionsService.create({ project_id: projectId, title: "running", agent: "claude-code" });
    const awaiting = await sessionsService.create({ project_id: projectId, title: "awaiting", agent: "claude-code" });
    const queued = await sessionsService.create({ project_id: projectId, title: "queued", agent: "claude-code" });
    const completed = await sessionsService.create({ project_id: projectId, title: "completed", agent: "claude-code" });

    await sessionsService.updateStatus(awaiting.id, "awaiting_input");
    await sessionsService.updateStatus(queued.id, "queued");
    await sessionsService.updateStatus(completed.id, "completed");

    await sessionsService.archive(awaiting.id);

    await expect(sessionsService.countActive()).resolves.toBe(2);
  });

  test("does not claim a queued session when its queue entry was removed", async () => {
    const sessionQueueEntriesService = createSessionQueueEntriesDBService(db);
    const queued = await sessionsService.createQueuedWithEntry({
      project_id: projectId,
      title: "queued",
      agent: "claude-code",
      prompt: "queued prompt",
      request_kind: "start",
    });
    const [entry] = await sessionQueueEntriesService.listPendingBySession(queued.id);
    await sessionQueueEntriesService.removeBySession(queued.id);

    await expect(sessionsService.claimQueuedForDispatch(queued.id, entry!.queue_position)).resolves.toBeNull();
    await expect(sessionsService.get(queued.id)).resolves.toMatchObject({ id: queued.id, status: "queued" });
  });

  test("can queue the same session after dispatched queue entry is removed", async () => {
    const sessionQueueEntriesService = createSessionQueueEntriesDBService(db);
    const queued = await sessionsService.createQueuedWithEntry({
      project_id: projectId,
      title: "queued twice",
      agent: "claude-code",
      prompt: "first queued prompt",
      request_kind: "follow_up",
    });

    const [entry] = await sessionQueueEntriesService.listPendingBySession(queued.id);
    await expect(sessionsService.claimQueuedForDispatch(queued.id, entry!.queue_position)).resolves.toMatchObject({
      id: queued.id,
      status: "in_progress",
    });
    await sessionQueueEntriesService.remove(entry!.queue_position);
    await sessionsService.updateStatus(queued.id, "completed");

    await expect(
      sessionsService.queueExistingWithEntry({
        id: queued.id,
        prompt: "second queued prompt",
        request_kind: "follow_up",
      }),
    ).resolves.toMatchObject({
      session: { id: queued.id, status: "queued" },
      entry: { session_id: queued.id, prompt: "second queued prompt" },
    });
  });

  test("sets start timestamp when claiming queued work for dispatch", async () => {
    const sessionQueueEntriesService = createSessionQueueEntriesDBService(db);
    const queued = await sessionsService.createQueuedWithEntry({
      project_id: projectId,
      title: "queued timestamp",
      agent: "claude-code",
      prompt: "queued timestamp prompt",
      request_kind: "start",
    });

    expect(queued.last_request_started).toBeNull();

    const [entry] = await sessionQueueEntriesService.listPendingBySession(queued.id);
    const claimed = await sessionsService.claimQueuedForDispatch(queued.id, entry!.queue_position);

    expect(claimed).toMatchObject({ id: queued.id, status: "in_progress" });
    expect(claimed?.last_request_started).toEqual(expect.any(String));
  });

  test("clears start timestamp when recovering a queued dispatch claim", async () => {
    const sessionQueueEntriesService = createSessionQueueEntriesDBService(db);
    const queued = await sessionsService.createQueuedWithEntry({
      project_id: projectId,
      title: "queued recovery timestamp",
      agent: "claude-code",
      prompt: "queued recovery timestamp prompt",
      request_kind: "start",
    });

    const [entry] = await sessionQueueEntriesService.listPendingBySession(queued.id);
    await sessionsService.claimQueuedForDispatch(queued.id, entry!.queue_position);

    const recovered = await sessionsService.recoverQueuedDispatchClaim(queued.id, entry!.queue_position);

    expect(recovered).toMatchObject({ id: queued.id, status: "queued", last_request_started: null });
  });

  test("list filters by agent", async () => {
    await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });
    await sessionsService.create({ project_id: projectId, title: "S2", agent: "opencode" });

    const list = await sessionsService.list(projectId, { agent: "opencode" });
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("S2");
  });

  test("lists by external agent session id", async () => {
    const first = await sessionsService.create({ project_id: projectId, title: "S1", agent: "opencode" });
    const second = await sessionsService.create({ project_id: projectId, title: "S2", agent: "opencode" });
    await sessionsService.create({ project_id: projectId, title: "S3", agent: "claude-code" });

    await sessionsService.update(first.id, { agent_session_id: "oc-123" });
    await sessionsService.update(second.id, { agent_session_id: "oc-123" });

    const list = await sessionsService.listByAgentSession("opencode", "oc-123");
    expect(list).toHaveLength(2);
    expect(list.map((session) => session.id)).toEqual([first.id, second.id]);
  });

  test("updates session status", async () => {
    const session = await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });
    const updated = await sessionsService.updateStatus(session.id, "completed");

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("completed");
  });

  test("archives a session", async () => {
    const session = await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });
    await sessionsService.archive(session.id);

    const fetched = await sessionsService.get(session.id);
    expect(fetched!.archived).toBe(true);
  });

  test("update sets fields", async () => {
    const session = await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });
    const updated = await sessionsService.update(session.id, {
      agent_session_id: "ext-123",
      last_selected_model: "claude-code-fast",
      last_request_started: new Date().toISOString(),
    });

    expect(updated).not.toBeNull();
    expect(updated!.agent_session_id).toBe("ext-123");
    expect(updated!.last_selected_model).toBe("claude-code-fast");
  });

  test("rejects invalid status values at DB layer", async () => {
    const session = await sessionsService.create({ project_id: projectId, title: "S1", agent: "claude-code" });

    await expect(
      db.execute(sql`update sessions set status = ${"paused"} where id = ${session.id}`).execute(),
    ).rejects.toThrow();
  });
});
