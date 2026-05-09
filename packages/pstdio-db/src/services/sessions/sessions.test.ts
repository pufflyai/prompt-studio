import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
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
