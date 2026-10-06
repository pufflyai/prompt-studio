import { expect, test } from "bun:test";
import {
  createDb,
  createProjectsDBService,
  createSessionQueueEntriesDBService,
  createSessionsDBService,
} from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createSessionService } from "./session-service";

// A queued session must keep a queue entry (architecture 0019). Archiving drops the entry, so
// the session has to leave `queued` through a cancel, with the same hooks as any cancel.
test("archiving a queued session cancels it and fires the status hook", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const raw = createSessionsDBService(db);
    const queue = createSessionQueueEntriesDBService(db);
    const project = await createProjectsDBService(db).create({ name: "Archive queued" });
    const session = await raw.createQueuedWithEntry({
      project_id: project.id,
      title: "Queued",
      agent: "test",
      prompt: "Start",
      request_kind: "start",
    });
    const statusChanges: string[] = [];
    const service = createSessionService({
      sessionsDb: raw,
      eventBus: new EventBus(),
      onSessionStatusChanged: (changed) => statusChanges.push(changed.status),
    });

    const archived = await service.archive(session.id);

    expect(archived).toMatchObject({ id: session.id, archived: true, status: "cancelled" });
    expect(await raw.get(session.id)).toMatchObject({ archived: true, status: "cancelled" });
    expect(await queue.listPendingBySession(session.id)).toEqual([]);
    expect(statusChanges).toEqual(["cancelled"]);
  } finally {
    await close();
  }
});
