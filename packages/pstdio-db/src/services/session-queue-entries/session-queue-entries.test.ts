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
