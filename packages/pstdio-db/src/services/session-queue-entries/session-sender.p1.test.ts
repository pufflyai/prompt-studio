import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createSessionsDBService } from "../sessions/sessions";
import { createSessionQueueEntriesDBService } from "./session-queue-entries";

test("queued sender attribution follows reordered requests and survives a database restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "session-sender-"));
  let connection = await createDb({ path: root });
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Senders" });
    const sessions = createSessionsDBService(connection.db);
    const sender = { type: "session" as const, id: "source-session", name: "Release checks" };
    const session = await sessions.createQueuedWithEntry({
      project_id: project.id,
      title: "Queued",
      agent: "fake",
      prompt: "First",
      request_kind: "start",
      sender_json: sender,
    });
    const queue = createSessionQueueEntriesDBService(connection.db);
    const next = await queue.create({
      session_id: session.id,
      prompt: "Second",
      request_kind: "follow_up",
      sender_json: { type: "user", id: "person", name: "Alex" },
    });
    expect((await queue.listPendingBySession(session.id))[0].sender_json).toEqual(sender);
    await queue.movePending({ sessionId: session.id, queuePosition: next.queue_position, direction: "up", steps: 1 });
    await connection.close();
    connection = await createDb({ path: root });
    const saved = await createSessionQueueEntriesDBService(connection.db).listPendingBySession(session.id);
    expect(saved.map((entry) => [entry.prompt, entry.sender_json])).toEqual([
      ["Second", { type: "user", id: "person", name: "Alex" }],
      ["First", sender],
    ]);
  } finally {
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});
