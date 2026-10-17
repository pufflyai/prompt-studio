import { expect, test } from "bun:test";
import {
  createDb,
  createProjectsDBService,
  createSessionQueueEntriesDBService,
  createSessionsDBService,
} from "pstdio-db";
import { createSessionService } from "../../services/session-service";
import { EventBus } from "../sync/event-bus";
import { prepareOrphanedSessionRecovery } from "./startup";

test("prepared orphan recovery preserves a dispatch claim returned to the queue", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const raw = createSessionsDBService(connection.db);
    const queue = createSessionQueueEntriesDBService(connection.db);
    const sessions = createSessionService({ sessionsDb: raw, eventBus: new EventBus() });
    const project = await createProjectsDBService(connection.db).create({ name: "Recovered queued work" });
    const session = await sessions.createQueuedWithEntry({
      project_id: project.id,
      title: "Pending",
      agent: "disabled",
      prompt: "Keep this work",
      request_kind: "start",
    });
    const [entry] = await queue.listPendingBySession(session.id);
    const claimed = await sessions.claimQueuedForDispatch(session.id, entry!.queue_position);
    const recovery = await prepareOrphanedSessionRecovery({
      sessionService: sessions,
      harnessRegistry: { get: async () => null },
    } as never);
    await sessions.recoverQueuedDispatchClaim(session.id, entry!.queue_position, claimed!.last_request_started);
    await recovery();
    expect((await sessions.get(session.id))!.status).toBe("queued");
    expect(await queue.listPendingBySession(session.id)).toHaveLength(1);
  } finally {
    await connection.close();
  }
});

test("prepared orphan recovery preserves a user stop during harness discovery", async () => {
  const connection = await createDb({ path: ":memory:" });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const sessions = createSessionService({
      sessionsDb: createSessionsDBService(connection.db),
      eventBus: new EventBus(),
    });
    const project = await createProjectsDBService(connection.db).create({ name: "Stopped recovery" });
    const session = await sessions.create({ project_id: project.id, title: "Stopped", agent: "slow" });
    const recover = await prepareOrphanedSessionRecovery({
      sessionService: sessions,
      harnessRegistry: {
        get: async () => ({
          supportsReattach: true,
          capabilities: async () => {
            entered.resolve();
            await release.promise;
            return [];
          },
        }),
      },
    } as never);
    const recovering = recover();
    await entered.promise;
    await sessions.transitionStatus(session.id, "cancelled", { drainCapacity: false });
    release.resolve();
    await recovering;
    expect((await sessions.get(session.id))?.status).toBe("cancelled");
  } finally {
    release.resolve();
    await connection.close();
  }
});
