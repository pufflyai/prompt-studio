import { expect, test } from "bun:test";
import { createProjectsDBService } from "../services/projects/projects";
import { createSessionQueueEntriesDBService } from "../services/session-queue-entries/session-queue-entries";
import { createSessionsDBService } from "../services/sessions/sessions";
import { createDb } from "./connection.pglite";
import { snapshotLegacyQueuedRequests } from "./queued-request-migration";
import { session_queue_entries } from "./schemas.pg";

test("legacy requests snapshot their original selection once and explicit provider defaults stay unchanged", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const { db } = connection;
    const project = await createProjectsDBService(db).create({ name: "Migration" });
    const sessions = createSessionsDBService(db);
    const queue = createSessionQueueEntriesDBService(db);
    const session = await sessions.create({
      project_id: project.id,
      title: "Migration",
      agent: "fake",
      last_selected_model: "old",
      params_json: { thinking: "high" },
    });
    const [legacy] = await db
      .insert(session_queue_entries)
      .values({
        session_id: session.id,
        prompt: "Legacy",
        request_kind: "follow_up",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning();
    const explicit = await queue.create({
      session_id: session.id,
      prompt: "Default model",
      request_kind: "follow_up",
      model: null,
      params_json: {},
    });
    await snapshotLegacyQueuedRequests(db);
    const migrated = await queue.get(legacy.queue_position);
    expect(migrated).toMatchObject({ model: "old", params_json: { thinking: "high" } });
    expect(migrated!.revision).not.toBe("");
    await sessions.update(session.id, { last_selected_model: "new", params_json: { thinking: "low" } });
    await snapshotLegacyQueuedRequests(db);
    expect(await queue.get(legacy.queue_position)).toEqual(migrated);
    expect(await queue.get(explicit.queue_position)).toMatchObject({
      model: null,
      params_json: {},
      revision: explicit.revision,
    });
  } finally {
    await connection.close();
  }
});
