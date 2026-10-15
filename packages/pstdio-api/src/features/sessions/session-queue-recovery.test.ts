import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { prepareQueuedSessionRecovery } from "./session-queue-recovery";
import { createSessionScheduler } from "./session-scheduler";

test.each(["pending", "claimed"])("restart recovery owns only captured %s entries", async (state) => {
  const started: string[] = [];
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("queue", {
        provider: {
          start: async (_context, input) => {
            started.push(input.prompt);
            return { agentSessionId: input.prompt, done: new Promise<never>(() => {}), stop: () => {} };
          },
        },
      }),
    ]),
  });
  try {
    await app.deps.settingsService.update({ max_concurrent_sessions: 3 });
    const project = await app.deps.projectService.create({ name: "Startup queue ownership" });
    const queue = (prompt: string) =>
      app.deps.sessionService.createQueuedWithEntry(
        {
          project_id: project.id,
          title: prompt,
          agent: testHarnessId("queue"),
          prompt,
          request_kind: "start",
        },
        { emitStartedHook: false },
      );
    const original = await queue("before");
    if (state === "claimed") {
      const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(original.id);
      await app.deps.sessionService.claimQueuedForDispatch(original.id, entry!.queue_position);
    }
    const recover = await prepareQueuedSessionRecovery(app.deps);
    const fresh = await queue("after");
    await recover();
    expect(started).toEqual(["before"]);
    expect((await app.deps.sessionService.get(fresh.id))?.status).toBe("queued");
    await createSessionScheduler(app.deps).drainQueue();
    expect(started).toEqual(["before", "after"]);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
  } finally {
    await app.close();
  }
});
