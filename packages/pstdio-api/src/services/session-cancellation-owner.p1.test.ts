import { expect, test } from "bun:test";
import {
  createDb,
  createProjectsDBService,
  createSessionQueueEntriesDBService,
  createSessionsDBService,
} from "pstdio-db";
import { inertSessionChannelHooks } from "../features/sessions/session-store.test-utils";
import { EventBus } from "../features/sync/event-bus";
import { createTestApp } from "../test-utils/create-test-app";
import { createSessionService } from "./session-service";

test("delayed cancellation cannot cancel a replacement conversation owner", async () => {
  const handle = await createTestApp();
  const stopping = Promise.withResolvers<void>();
  const stopped = Promise.withResolvers<void>();
  try {
    const service = handle.deps.sessionService;
    const project = await handle.deps.projectService.create({ name: "Cancellation owner" });
    const session = await service.create({ project_id: project.id, title: "Run", agent: "test" });
    const previous = service.store.create(session.id, inertSessionChannelHooks);
    service.store.setSession(session.id, {
      agentSessionId: "old",
      done: new Promise(() => {}),
      stop: async () => {
        stopping.resolve();
        await stopped.promise;
      },
    });
    const cancelling = service.cancel(session.id);
    await stopping.promise;
    const next = service.store.create(session.id, inertSessionChannelHooks);
    await service.resume(session.id);
    const before = await service.get(session.id);
    stopped.resolve();
    expect(await cancelling).toBeNull();
    expect(service.store.get(session.id)).toBe(next);
    expect(await service.get(session.id)).toEqual(before);
    expect(previous.cancellationRequested).toBe(true);
    expect(next.cancellationRequested).toBe(false);
  } finally {
    stopped.resolve();
    await handle.close();
  }
});

test("queued cancellation cannot stop the run that won the dispatch claim", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  const read = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const raw = createSessionsDBService(db);
    const queue = createSessionQueueEntriesDBService(db);
    const project = await createProjectsDBService(db).create({ name: "Queued cancellation" });
    const session = await raw.createQueuedWithEntry({
      project_id: project.id,
      title: "Queued",
      agent: "test",
      prompt: "Start",
      request_kind: "start",
    });
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
      eventBus: new EventBus(),
    });
    const cancelling = service.cancel(session.id);
    await read.promise;
    const [pending] = await queue.listPendingBySession(session.id);
    const claimed = await raw.claimQueuedForDispatch(session.id, pending.queue_position);
    let stopped = false;
    const owner = service.store.create(session.id, inertSessionChannelHooks);
    service.store.setSession(session.id, {
      done: new Promise(() => {}),
      stop: () => {
        stopped = true;
      },
    });
    release.resolve();
    expect(await cancelling).toBeNull();
    expect(stopped).toBe(false);
    expect(owner.cancellationRequested).toBe(false);
    expect(await raw.get(session.id)).toEqual(claimed!);
  } finally {
    release.resolve();
    await close();
  }
});
