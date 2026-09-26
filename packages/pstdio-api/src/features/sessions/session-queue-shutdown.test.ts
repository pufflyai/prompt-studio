import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { createSessionScheduler } from "./session-scheduler";

test.each(["capacity", "settings", "scheduler"])("shutdown waits for a drain started by %s", async (trigger) => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("delayed", {
      provider: {
        start: async () => {
          entered.resolve();
          await release.promise;
          return { agentSessionId: "accepted", done: new Promise<never>(() => {}), stop: () => {} };
        },
      },
    }),
  ]);
  const app = await createTestApp({ harnessRegistry: registry });
  let draining: Promise<unknown> | undefined;
  let closing: Promise<void> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Capacity shutdown" });
    const active = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Active",
      agent: testHarnessId("delayed"),
    });
    await app.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Pending start",
        agent: testHarnessId("delayed"),
        prompt: "keep me",
        request_kind: "start",
      },
      { emitStartedHook: false },
    );
    if (trigger === "capacity") draining = app.deps.sessionService.transitionStatus(active.id, "completed");
    if (trigger === "settings") draining = app.deps.settingsService.update({ max_concurrent_sessions: 3 });
    if (trigger === "scheduler") draining = createSessionScheduler(app.deps).drainQueue();
    await entered.promise;
    let closed = false;
    closing = app.close().then(() => {
      closed = true;
    });
    await Bun.sleep(100);
    expect(closed).toBe(false);
  } finally {
    release.resolve();
    await draining;
    await (closing ?? app.close());
  }
});

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
