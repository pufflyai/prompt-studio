import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { createSessionScheduler } from "./session-scheduler";

test.each(["start", "follow_up", "resume"])("queue drain waits for %s and durable queue cleanup", async (kind) => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const start = async () => {
    entered.resolve();
    await release.promise;
    return { agentSessionId: "accepted", done: new Promise<never>(() => {}), stop: () => {} };
  };
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("delayed", { provider: { start, resume: start, getMessages: () => [] } }),
  ]);
  const app = await createTestApp({ harnessRegistry: registry });
  let drain: Promise<void> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Queue shutdown" });
    const session = await app.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Pending start",
        agent: testHarnessId("delayed"),
        prompt: "keep me",
        request_kind: kind === "start" ? "start" : "follow_up",
      },
      { emitStartedHook: false },
    );
    if (kind === "resume") await app.deps.sessionService.update(session.id, { agent_session_id: "previous" });
    let drained = false;
    drain = createSessionScheduler(app.deps)
      .drainQueue()
      .then(() => {
        drained = true;
      });
    await entered.promise;
    await Bun.sleep(10);
    expect(drained).toBe(false);
    release.resolve();
    await drain;
    expect(await app.deps.sessionService.get(session.id)).toMatchObject({
      agent_session_id: kind === "resume" ? "previous" : "accepted",
    });
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
  } finally {
    release.resolve();
    await drain;
    await app.close();
  }
});
