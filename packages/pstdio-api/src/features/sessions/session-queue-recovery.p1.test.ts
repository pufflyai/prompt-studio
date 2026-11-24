import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { getSessionHistory } from "./session-history";
import { prepareQueuedSessionRecovery } from "./session-queue-recovery";
import { createSessionScheduler } from "./session-scheduler";
import { reattachAgentSession } from "./spawn-agent";

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

test("an unconfirmed sender-bearing handoff is retained without replay when native history is unavailable", async () => {
  let launches = 0;
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("uncertain-source", {
        provider: {
          start: () => {
            launches++;
            return { agentSessionId: "native", done: new Promise<never>(() => {}), stop: () => {} };
          },
          getMessages: () => [],
        },
      }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Uncertain sender" });
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Unconfirmed",
      agent: testHarnessId("uncertain-source"),
      prompt: "Keep this intent",
      request_kind: "start",
      sender_json: { type: "user", id: "person", name: "Alex" },
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    await app.deps.sessionService.claimQueuedForDispatch(session.id, entry!.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(entry!.queue_position, 0);
    await app.deps.sessionService.update(session.id, { agent_session_id: "native" });
    await (await prepareQueuedSessionRecovery(app.deps))();
    expect(launches).toBe(0);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toHaveLength(1);
    expect(await app.deps.sessionQueueEntriesService.listPending()).toEqual([]);
  } finally {
    await app.close();
  }
});

test("reattachment attributes a late native prompt and retires only its durable checkpoint", async () => {
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("late-source", {
        provider: {
          getMessages: () => [],
          capabilities: () => ["SessionReattach"],
          reattach: (_ctx, input) => {
            input.events.push({
              op: "add",
              path: "/messages/0",
              value: { id: "late-prompt", role: "user", parts: [{ type: "text", text: "Accepted late" }] },
            });
            return {
              agentSessionId: "native",
              done: Promise.resolve({ status: "completed" as const }),
              stop: () => {},
            };
          },
        },
      }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Late sender" });
    const sender = { type: "user" as const, id: "person", name: "Alex" };
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Reattach",
      agent: testHarnessId("late-source"),
      prompt: "Accepted late",
      request_kind: "start",
      sender_json: sender,
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    await app.deps.sessionService.claimQueuedForDispatch(session.id, entry!.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(entry!.queue_position, 0);
    await app.deps.sessionService.update(session.id, { agent_session_id: "native" });
    await reattachAgentSession(
      {
        sessionId: session.id,
        projectId: project.id,
        agentSessionId: "native",
        agentId: testHarnessId("late-source"),
        sender,
        prompt: "Accepted late",
        submittedQueuePosition: entry!.queue_position,
      },
      app.deps,
    );
    for (let i = 0; i < 100 && (await app.deps.sessionService.get(session.id))?.status !== "completed"; i++)
      await Bun.sleep(10);
    expect((await getSessionHistory(session.id, app.deps))[0].sender).toMatchObject({
      ...sender,
      requestId: `${session.id}:${entry!.queue_position}`,
    });
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
  } finally {
    await app.close();
  }
});

test("restart checkpoints confirmed sender attribution without dispatching the prompt twice", async () => {
  let launches = 0;
  let nativeTime = Math.floor(Date.now() / 1000) * 1000;
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("attribution", {
        provider: {
          start: () => {
            launches++;
            return { agentSessionId: "native", done: new Promise<never>(() => {}), stop: () => {} };
          },
          resume: () => {
            launches++;
            return { agentSessionId: "native", done: new Promise<never>(() => {}), stop: () => {} };
          },
          getMessages: () => [
            {
              id: "native-prompt",
              role: "user",
              createdAt: nativeTime,
              parts: [{ type: "text", text: "Accepted once" }],
            },
          ],
        },
      }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Attribution recovery" });
    const sender = { type: "session" as const, id: "source", name: "Release checks" };
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Already started",
      agent: testHarnessId("attribution"),
      prompt: "Accepted once",
      request_kind: "start",
      sender_json: sender,
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    await app.deps.sessionService.claimQueuedForDispatch(session.id, entry!.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(entry!.queue_position, 0);
    await app.deps.sessionService.update(session.id, { agent_session_id: "native" });
    nativeTime = Math.floor(Date.now() / 1000) * 1000;
    await (await prepareQueuedSessionRecovery(app.deps))();
    expect(launches).toBe(0);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
    expect((await getSessionHistory(session.id, app.deps))[0].sender).toMatchObject(sender);
    expect((await app.deps.sessionService.get(session.id))?.session_file_id).toBeString();
  } finally {
    await app.close();
  }
});
