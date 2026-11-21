import { expect, test } from "bun:test";
import {
  createDb,
  createProjectsDBService,
  createSessionQueueEntriesDBService,
  createSessionsDBService,
} from "pstdio-db";
import { inertSessionChannelHooks } from "../features/sessions/session-store.test-utils";
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

test("a delayed completion cannot undo Stop or release its saved follow-ups", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  const read = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let removeOwner = () => {};
  try {
    const raw = createSessionsDBService(db);
    const queue = createSessionQueueEntriesDBService(db);
    const project = await createProjectsDBService(db).create({ name: "Stopped completion" });
    const session = await raw.create({ project_id: project.id, title: "Run", agent: "test" });
    await raw.insertEntryForActive({ id: session.id, prompt: "Saved follow-up", request_kind: "follow_up" });
    let intercept = true;
    const released: string[] = [];
    const service = createSessionService({
      sessionsDb: {
        ...raw,
        get: async (id) => {
          const snapshot = await raw.get(id);
          if (intercept) {
            intercept = false;
            read.resolve();
            await release.promise;
          }
          return snapshot;
        },
      },
      eventBus: new EventBus(),
      onCapacityAvailable: async () => {
        released.push((await raw.get(session.id))!.status);
      },
    });
    const owner = service.store.create(session.id, inertSessionChannelHooks);
    removeOwner = () => service.store.remove(session.id, owner);
    const completing = service.transitionStatus(session.id, "completed", { expectedOwner: owner });
    await read.promise;
    await service.cancel(session.id);
    release.resolve();
    expect(await completing).toBeNull();
    expect(await raw.get(session.id)).toMatchObject({ status: "cancelled" });
    expect((await queue.listPendingBySession(session.id)).map((entry) => entry.prompt)).toEqual(["Saved follow-up"]);
    expect(released).toEqual(["cancelled"]);
  } finally {
    release.resolve();
    removeOwner();
    await close();
  }
});
