import { expect, test } from "bun:test";
import {
  createDb,
  createProjectsDBService,
  createSessionQueueEntriesDBService,
  createSessionsDBService,
} from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createSessionService } from "./session-service";

test("a delayed terminal transition preserves the replacement run and its queued messages", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  const read = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const raw = createSessionsDBService(db);
    const queue = createSessionQueueEntriesDBService(db);
    const project = await createProjectsDBService(db).create({ name: "Stale transition" });
    const session = await raw.create({ project_id: project.id, title: "Run", agent: "test" });
    const eventBus = new EventBus();
    const service = createSessionService({
      sessionsDb: {
        ...raw,
        get: async (id) => {
          const snapshot = await raw.get(id);
          read.resolve();
          await release.promise;
          return snapshot;
        },
      },
      eventBus,
    });
    const cancelling = service.transitionStatus(session.id, "cancelled", {
      expectedLastRequestStarted: session.last_request_started,
    });
    await read.promise;
    await raw.update(session.id, { last_request_started: "2099-01-01T00:00:00.000Z" });
    await raw.insertEntryForActive({ id: session.id, prompt: "Replacement follow-up", request_kind: "follow_up" });
    const before = await raw.get(session.id);
    release.resolve();
    expect(await cancelling).toBeNull();
    expect(await raw.get(session.id)).toEqual(before);
    expect(await queue.listPendingBySession(session.id)).toHaveLength(1);
    expect(eventBus.seq).toBe(0);
  } finally {
    release.resolve();
    await close();
  }
});
