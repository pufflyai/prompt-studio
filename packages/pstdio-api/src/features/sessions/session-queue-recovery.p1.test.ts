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
    const { persistSessionMessages } = await import("./session-messages");
    await persistSessionMessages(
      session.id,
      [
        {
          id: "native-prompt",
          role: "user",
          parts: [{ type: "text", text: "Accepted once" }],
          sender: { ...sender, requestId: `${session.id}:${entry!.queue_position}` },
        },
      ],
      app.deps,
    );
    await (await prepareQueuedSessionRecovery(app.deps))();
    expect(launches).toBe(0);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
    expect((await getSessionHistory(session.id, app.deps))[0].sender).toMatchObject(sender);
    expect((await app.deps.sessionService.get(session.id))?.session_file_id).toBeString();
  } finally {
    await app.close();
  }
});

test.each([
  "attachment",
  "checkpoint",
])("restart retains a %s guard and continues unrelated queued work", async (failure) => {
  const started: string[] = [];
  const sender = { type: "user" as const, id: "person", name: "Alex" };
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("recovery-guard", {
        provider: {
          start: (_ctx, input) => {
            started.push(input.prompt);
            return { agentSessionId: "other", done: new Promise<never>(() => {}), stop: () => {} };
          },
          getMessages: () => [],
        },
      }),
    ]),
  });
  try {
    await app.deps.settingsService.update({ max_concurrent_sessions: 3 });
    const project = await app.deps.projectService.create({ name: "Recovery guards" });
    const held = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Held",
      agent: testHarnessId("recovery-guard"),
      prompt: "Held",
      request_kind: "start",
      sender_json: sender,
      attachments_json: failure === "attachment" ? [{ file_id: "protected-upload" }] : [],
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(held.id);
    await app.deps.sessionService.claimQueuedForDispatch(held.id, entry.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(entry.queue_position, 0);
    const { persistSessionMessages } = await import("./session-messages");
    await persistSessionMessages(
      held.id,
      [
        {
          id: "confirmed",
          role: "user",
          parts: [{ type: "text", text: "Held" }],
          sender: { ...sender, requestId: `${held.id}:${entry.queue_position}` },
        },
      ],
      app.deps,
    );
    await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Other",
      agent: testHarnessId("recovery-guard"),
      prompt: "Other",
      request_kind: "start",
    });
    const update = app.deps.fileService.update;
    if (failure === "checkpoint")
      app.deps.fileService.update = async () => {
        throw new Error("checkpoint unavailable");
      };
    try {
      await (await prepareQueuedSessionRecovery(app.deps))();
      expect(started).toEqual(["Other"]);
      expect(await app.deps.sessionQueueEntriesService.get(entry.queue_position)).not.toBeNull();
      expect(await app.deps.sessionQueueEntriesService.listPendingBySession(held.id)).toEqual([]);
    } finally {
      app.deps.fileService.update = update;
    }
    const messages = await getSessionHistory(held.id, app.deps);
    if (failure === "attachment")
      messages[0].parts.push({ type: "file", fileId: "protected-upload", url: "/attachments/protected-upload" });
    await persistSessionMessages(held.id, messages, app.deps);
    await (await prepareQueuedSessionRecovery(app.deps))();
    expect(await app.deps.sessionQueueEntriesService.get(entry.queue_position)).toBeNull();
    expect(started).toEqual(["Other"]);
  } finally {
    await app.close();
  }
});

test.each([
  false,
  true,
])("reattachment selects only the current run's sender (current entry: %s)", async (hasCurrent) => {
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("newer-run", {
        provider: {
          capabilities: () => ["SessionReattach"],
          getMessages: () => [],
          reattach: (_ctx, input) => {
            input.events.push({
              op: "add",
              path: "/messages/0",
              value: {
                id: "new-request",
                role: "user",
                parts: [{ type: "text", text: "Same prompt" }],
              },
            });
            return { agentSessionId: "native", done: new Promise<never>(() => {}), stop: () => {} };
          },
        },
      }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Run ownership" });
    const sender = { type: "user" as const, id: "original", name: "Original" };
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Old handoff",
      agent: testHarnessId("newer-run"),
      prompt: "Same prompt",
      request_kind: "start",
      sender_json: sender,
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    await app.deps.sessionService.claimQueuedForDispatch(session.id, entry.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(entry.queue_position, 0);
    await app.deps.sessionService.update(session.id, { agent_session_id: "native", last_request_started: "new-run" });
    if (hasCurrent) {
      const current = await app.deps.sessionQueueEntriesService.createDispatchStarted({
        session_id: session.id,
        prompt: "Same prompt",
        request_kind: "follow_up",
        sender_json: { type: "user", id: "current", name: "Current" },
      });
      await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(current.queue_position, 0);
    }
    const { resolveOrphanedSessions } = await import("./startup");
    await resolveOrphanedSessions(app.deps);
    const recovered = (await getSessionHistory(session.id, app.deps))[0].sender;
    if (hasCurrent) expect(recovered).toMatchObject({ id: "current", name: "Current" });
    else expect(recovered).toBeUndefined();
    expect(await app.deps.sessionQueueEntriesService.get(entry.queue_position)).not.toBeNull();
  } finally {
    await app.close();
  }
});
