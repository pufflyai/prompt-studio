import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { isSessionAttachmentSubmitted } from "./session-attachments";
import { getSessionHistory } from "./session-history";
import { persistSessionMessages } from "./session-messages";
import { prepareQueuedSessionRecovery } from "./session-queue-recovery";
import { createSessionScheduler } from "./session-scheduler";
import { reattachAgentSession } from "./spawn-agent";
import { prepareOrphanedSessionRecovery } from "./startup";

test.each([
  false,
  true,
])("reattachment checkpoints only the current run's proven request (current entry: %s)", async (hasCurrent) => {
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
    const project = await app.deps.projectService.create({ name: "Run ownership" });
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Old handoff",
      agent: testHarnessId("newer-run"),
      prompt: "Same prompt",
      request_kind: "start",
      sender_json: { type: "user", id: "original", name: "Original" },
    });
    const [old] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    const claimed = await app.deps.sessionService.claimQueuedForDispatch(session.id, old!.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      old!.queue_position,
      0,
      claimed!.last_request_started!,
    );
    const nextRun = new Date(Date.parse(claimed!.last_request_started!) + 1).toISOString();
    await app.deps.sessionService.update(session.id, { agent_session_id: "native", last_request_started: nextRun });
    const sender = { type: "user" as const, id: "current", name: "Current" };
    const current = hasCurrent
      ? await app.deps.sessionQueueEntriesService.createDispatchStarted({
          session_id: session.id,
          prompt: "Same prompt",
          request_kind: "follow_up",
          sender_json: sender,
        })
      : undefined;
    if (current) {
      await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(current.queue_position, 0, nextRun);
      await persistSessionMessages(
        session.id,
        [
          {
            id: "new-request",
            role: "user",
            parts: [{ type: "text", text: "Same prompt" }],
            sender: { ...sender, requestId: `${session.id}:${current.queue_position}` },
          },
        ],
        app.deps,
      );
    }
    await (await prepareOrphanedSessionRecovery(app.deps))();
    for (let i = 0; i < 100 && (await app.deps.sessionService.get(session.id))?.status !== "completed"; i++)
      await Bun.sleep(10);
    expect((await app.deps.sessionService.get(session.id))?.status).toBe("completed");
    const recovered = (await getSessionHistory(session.id, app.deps))[0].sender;
    if (current) {
      expect(recovered).toMatchObject(sender);
      expect(await app.deps.sessionQueueEntriesService.get(current.queue_position)).toBeNull();
    } else expect(recovered).toBeUndefined();
    expect(await app.deps.sessionQueueEntriesService.get(old!.queue_position)).not.toBeNull();
  } finally {
    await app.close();
  }
});

test("permanent reattach failure keeps an unconfirmed sender's attachment protection", async () => {
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("failed-reattach-source", {
        provider: {
          getMessages: () => [],
          capabilities: () => ["SessionReattach"],
          reattach: () => {
            throw new Error("Native reattach is permanently unavailable");
          },
        },
      }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Retained files" });
    const file = await app.deps.fileService.upload({
      project_id: project.id,
      file_name: "retained.txt",
      file_kind: "session_attachment",
      mime_type: "text/plain",
      data: Buffer.from("retained"),
    });
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Unconfirmed",
      agent: testHarnessId("failed-reattach-source"),
      request_kind: "start",
      prompt: "Inspect",
      sender_json: { type: "user", id: "person", name: "Alex" },
      attachments_json: [{ file_id: file.id }],
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    const claimed = await app.deps.sessionService.claimQueuedForDispatch(session.id, entry!.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry!.queue_position,
      0,
      claimed!.last_request_started!,
    );
    await app.deps.sessionService.update(session.id, { agent_session_id: "native" });
    await (await prepareOrphanedSessionRecovery(app.deps))();
    expect((await app.deps.sessionService.get(session.id))?.status).toBe("disconnected");
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toHaveLength(1);
    expect(await isSessionAttachmentSubmitted(app.deps, project.id, file.id)).toBe(true);
  } finally {
    await app.close();
  }
});

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
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry!.queue_position,
      0,
      (await app.deps.sessionService.get(session.id))!.last_request_started!,
    );
    await app.deps.sessionService.update(session.id, { agent_session_id: "native" });
    await (await prepareQueuedSessionRecovery(app.deps))();
    expect(launches).toBe(0);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toHaveLength(1);
    expect(await app.deps.sessionQueueEntriesService.listPending()).toEqual([]);
  } finally {
    await app.close();
  }
});

test("reattachment does not give a later native prompt an unconfirmed request's sender", async () => {
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
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry!.queue_position,
      0,
      (await app.deps.sessionService.get(session.id))!.last_request_started!,
    );
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
    expect((await getSessionHistory(session.id, app.deps))[0].sender).toBeUndefined();
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toHaveLength(1);
  } finally {
    await app.close();
  }
});

test.each([
  false,
  true,
])("restart checkpoints the recorded request without replay (later request timestamp: %s)", async (laterRequest) => {
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
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry!.queue_position,
      0,
      (await app.deps.sessionService.get(session.id))!.last_request_started!,
    );
    await app.deps.sessionService.update(session.id, { agent_session_id: "native" });
    nativeTime = Math.floor(Date.now() / 1000) * 1000;
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
    if (laterRequest) {
      const current = (await app.deps.sessionService.get(session.id))!;
      await app.deps.sessionService.update(session.id, {
        last_request_started: new Date(Date.parse(current.last_request_started!) + 1).toISOString(),
      });
    }
    await (await prepareQueuedSessionRecovery(app.deps))();
    expect(launches).toBe(0);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
    expect((await getSessionHistory(session.id, app.deps))[0].sender).toMatchObject(sender);
    expect((await app.deps.sessionService.get(session.id))?.session_file_id).toBeString();
  } finally {
    await app.close();
  }
});

test.each([false, true])("a native-only prompt stays unknown after restart (later host run: %s)", async (laterRun) => {
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("unknown-source", {
        provider: {
          getMessages: () => [{ id: "later-native", role: "user", parts: [{ type: "text", text: "Same prompt" }] }],
        },
      }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Unknown delivery" });
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Unknown",
      agent: testHarnessId("unknown-source"),
      prompt: "Same prompt",
      request_kind: "start",
      sender_json: { type: "user", id: "first", name: "First person" },
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    const claimed = await app.deps.sessionService.claimQueuedForDispatch(session.id, entry!.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry!.queue_position,
      0,
      claimed!.last_request_started!,
    );
    await app.deps.sessionService.update(session.id, {
      agent_session_id: "native",
      ...(laterRun
        ? {
            last_request_started: new Date(Date.parse(claimed!.last_request_started!) + 1).toISOString(),
          }
        : {}),
    });
    await (await prepareQueuedSessionRecovery(app.deps))();
    expect((await getSessionHistory(session.id, app.deps))[0].sender).toBeUndefined();
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toHaveLength(1);
  } finally {
    await app.close();
  }
});

test.each([
  false,
  true,
])("restart retires an exact request only with all attachment references (complete: %s)", async (complete) => {
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("attachment-source", { provider: { getMessages: () => [] } }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Attachment checkpoint" });
    const file = await app.deps.fileService.upload({
      project_id: project.id,
      file_name: "evidence.txt",
      file_kind: "session_attachment",
      mime_type: "text/plain",
      data: Buffer.from("evidence"),
    });
    const sender = { type: "user" as const, id: "person", name: "Alex" };
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Submitted file",
      agent: testHarnessId("attachment-source"),
      prompt: "Inspect evidence",
      request_kind: "start",
      sender_json: sender,
      attachments_json: [{ file_id: file.id }],
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    const claimed = await app.deps.sessionService.claimQueuedForDispatch(session.id, entry!.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry!.queue_position,
      0,
      claimed!.last_request_started!,
    );
    await app.deps.sessionService.update(session.id, { agent_session_id: "native" });
    await persistSessionMessages(
      session.id,
      [
        {
          id: "exact-prompt",
          role: "user",
          parts: [
            { type: "text", text: "Inspect evidence" },
            ...(complete
              ? [
                  {
                    type: "file" as const,
                    fileId: file.id,
                    filename: "evidence.txt",
                    mediaType: "text/plain",
                    url: "https://example.test/evidence",
                  },
                ]
              : []),
          ],
          sender: { ...sender, requestId: `${session.id}:${entry!.queue_position}` },
        },
      ],
      app.deps,
    );
    await (await prepareQueuedSessionRecovery(app.deps))();
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toHaveLength(complete ? 0 : 1);
    expect(await isSessionAttachmentSubmitted(app.deps, project.id, file.id)).toBe(true);
  } finally {
    await app.close();
  }
});

test("a failed recovered checkpoint stays held while later queued work drains", async () => {
  const launches: string[] = [];
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("checkpoint-source", {
        provider: {
          getMessages: () => [],
          start: (_ctx, input) => {
            launches.push(input.prompt);
            return { agentSessionId: "next-native", done: new Promise<never>(() => {}), stop: () => {} };
          },
        },
      }),
    ]),
  });
  const updateFile = app.deps.fileService.update;
  try {
    await app.deps.settingsService.update({ max_concurrent_sessions: 3 });
    const project = await app.deps.projectService.create({ name: "Independent recovery" });
    const sender = { type: "user" as const, id: "person", name: "Alex" };
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Held",
      agent: testHarnessId("checkpoint-source"),
      prompt: "Recorded",
      request_kind: "start",
      sender_json: sender,
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    const claimed = await app.deps.sessionService.claimQueuedForDispatch(session.id, entry!.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry!.queue_position,
      0,
      claimed!.last_request_started!,
    );
    await app.deps.sessionService.update(session.id, { agent_session_id: "native" });
    await persistSessionMessages(
      session.id,
      [
        {
          id: "recorded",
          role: "user",
          parts: [{ type: "text", text: "Recorded" }],
          sender: { ...sender, requestId: `${session.id}:${entry!.queue_position}` },
        },
      ],
      app.deps,
    );
    const fileId = (await app.deps.sessionService.get(session.id))!.session_file_id;
    app.deps.fileService.update = async (...args) => {
      if (args[0] === fileId) throw new Error("Checkpoint storage unavailable");
      return updateFile(...args);
    };
    const next = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Next",
      agent: testHarnessId("checkpoint-source"),
      prompt: "Next independent request",
      request_kind: "start",
    });
    await expect((await prepareQueuedSessionRecovery(app.deps))()).resolves.toBeUndefined();
    expect(launches).toEqual(["Next independent request"]);
    expect((await app.deps.sessionService.get(next.id))?.status).toBe("in_progress");
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([
      expect.objectContaining({ queue_position: entry!.queue_position }),
    ]);
  } finally {
    app.deps.fileService.update = updateFile;
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
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry.queue_position,
      0,
      (await app.deps.sessionService.get(held.id))!.last_request_started!,
    );
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
