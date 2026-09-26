import { describe, expect, mock, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createSessionScheduler } from "./session-scheduler";

describe("session scheduler cancellation", () => {
  test("a delayed capacity drain preserves follow-ups accepted by a replacement run", async () => {
    const handle = await createTestApp();
    const read = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    try {
      const service = handle.deps.sessionService;
      const project = await handle.deps.projectService.create({ name: "Capacity drain" });
      const session = await service.create({ project_id: project.id, title: "Run", agent: "test" });
      await service.transitionStatus(session.id, "cancelled", { drainCapacity: false });
      const scheduler = createSessionScheduler({
        ...handle.deps,
        sessionService: {
          ...service,
          get: async (id) => {
            const snapshot = await service.get(id);
            read.resolve();
            await release.promise;
            return snapshot;
          },
        },
      });
      const draining = scheduler.drainQueue({ releasedSessionId: session.id });
      await read.promise;
      await service.resume(session.id);
      await service.insertEntryForActive({ id: session.id, prompt: "Next run", request_kind: "follow_up" });
      release.resolve();
      await draining;
      expect(await handle.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toHaveLength(1);
    } finally {
      release.resolve();
      await handle.close();
    }
  });

  test("removes a follow-up inserted while its request is cancelled", async () => {
    const inserted = Promise.withResolvers<{ queue_position: number }>();
    const remove = mock(async () => {});
    const session = {
      id: "session-1",
      project_id: "project-1",
      status: "in_progress",
      agent: "pstdio.harness.test",
      last_selected_model: null,
    };
    const controller = new AbortController();
    const scheduler = createSessionScheduler({
      sessionService: {
        get: async () => session,
        insertEntryForActive: async () => inserted.promise,
      },
      sessionQueueEntriesService: { remove },
    } as never);

    const scheduling = scheduler.startOrQueueExisting({
      session: session as never,
      prompt: "follow up",
      signal: controller.signal,
    });
    await Bun.sleep(0);
    controller.abort(new DOMException("cancelled", "AbortError"));
    inserted.resolve({ queue_position: 7 });

    await expect(scheduling).rejects.toThrow();
    expect(remove).toHaveBeenCalledWith(7);
  });
});
