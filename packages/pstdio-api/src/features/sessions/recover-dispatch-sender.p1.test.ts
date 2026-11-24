import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { reconcileQueuedSteering } from "./queued-steering";
import { recoverDispatchSender } from "./recover-dispatch-sender";
import { getSessionHistory } from "./session-history";
import { persistSessionMessages } from "./session-messages";
import { withSchedulingLock } from "./session-scheduler-internals";

test("dispatch recovery waits for steering reconciliation before reading its checkpoint", async () => {
  const app = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const getSession = app.deps.sessionService.get;
  let blocked: Promise<void> | undefined;
  let reconciliation: Promise<void> | undefined;
  let recovery: Promise<boolean> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Recovery checkpoint ownership" });
    const sender = { type: "user" as const, id: "original", name: "Original" };
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Recovered dispatch",
      agent: "unavailable",
      prompt: "Original prompt",
      request_kind: "start",
      sender_json: sender,
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    const claimed = await app.deps.sessionService.claimQueuedForDispatch(session.id, entry.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry.queue_position,
      0,
      claimed!.last_request_started!,
    );
    const dispatch = (await app.deps.sessionQueueEntriesService.get(entry.queue_position))!;
    const steeringSender = { type: "user" as const, id: "steering", name: "Steering person" };
    const steering = await app.deps.sessionQueueEntriesService.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "Steered prompt",
      sender_json: steeringSender,
    });
    await app.deps.sessionQueueEntriesService.claimSteering(steering.queue_position, steering.revision, {
      id: "steering-delivery",
      runStartedAt: claimed!.last_request_started!,
    });
    await persistSessionMessages(
      session.id,
      [
        {
          id: "original-prompt",
          role: "user",
          parts: [{ type: "text", text: "Original prompt" }],
          sender: { ...sender, requestId: `${session.id}:${entry.queue_position}` },
        },
        { id: "steering-delivery", role: "user", parts: [{ type: "text", text: "Steered prompt" }] },
      ],
      app.deps,
    );
    const current = (await getSession(session.id))!;
    blocked = withSchedulingLock(async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    let lockHeld = true;
    let readBeforeReconciliation = false;
    app.deps.sessionService.get = (...args) => {
      if (lockHeld) readBeforeReconciliation = true;
      return getSession(...args);
    };
    reconciliation = reconcileQueuedSteering(app.deps, session.id);
    recovery = recoverDispatchSender(app.deps, current, dispatch);
    // Both operations are queued behind the same writer. Recovery must not
    // capture an older checkpoint while reconciliation is waiting to save it.
    await Promise.resolve();
    lockHeld = false;
    release.resolve();
    await Promise.all([blocked, reconciliation, recovery]);
    expect(readBeforeReconciliation).toBe(false);
    expect((await getSessionHistory(session.id, app.deps)).map((message) => message.sender)).toEqual([
      { ...sender, requestId: `${session.id}:${entry.queue_position}` },
      { ...steeringSender, requestId: `${session.id}:${steering.queue_position}` },
    ]);
    expect(await app.deps.sessionQueueEntriesService.get(entry.queue_position)).toBeNull();
    expect(await app.deps.sessionQueueEntriesService.get(steering.queue_position)).toBeNull();
  } finally {
    release.resolve();
    await Promise.allSettled([blocked, reconciliation, recovery]);
    app.deps.sessionService.get = getSession;
    await app.close();
  }
});

test.each([
  "saved",
  "native",
  "concurrent",
  "unconfirmed-change",
])("%s recovery keeps provider waits outside queue coordination", async (kind) => {
  const arrived = Promise.withResolvers<void>();
  const release = Promise.withResolvers<SessionMessage[]>();
  let providerReads = 0;
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("slow-history", {
        provider: {
          getMessages: () => {
            providerReads++;
            arrived.resolve();
            return release.promise;
          },
        },
      }),
    ]),
  });
  let recovery: Promise<boolean> | undefined;
  let coordination: Promise<void> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Independent queue coordination" });
    const sender = { type: "user" as const, id: "original", name: "Original" };
    const session = await app.deps.sessionService.createQueuedWithEntry({
      project_id: project.id,
      title: "Slow native history",
      agent: testHarnessId("slow-history"),
      prompt: "Original prompt",
      request_kind: "start",
      sender_json: sender,
    });
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
    const claimed = await app.deps.sessionService.claimQueuedForDispatch(session.id, entry.queue_position);
    await app.deps.sessionQueueEntriesService.setDispatchSenderBoundary(
      entry.queue_position,
      0,
      claimed!.last_request_started!,
    );
    await app.deps.sessionService.update(session.id, { agent_session_id: "native" });
    const message: SessionMessage = {
      id: "original-prompt",
      role: "user",
      parts: [{ type: "text", text: "Original prompt" }],
      sender: { ...sender, requestId: `${session.id}:${entry.queue_position}` },
    };
    await persistSessionMessages(
      session.id,
      [{ ...message, sender: kind === "saved" ? message.sender : undefined }],
      app.deps,
    );
    const current = (await app.deps.sessionService.get(session.id))!;
    const dispatch = (await app.deps.sessionQueueEntriesService.get(entry.queue_position))!;
    recovery = recoverDispatchSender(app.deps, current, dispatch);
    if (kind !== "saved") await arrived.promise;
    const steered: SessionMessage = {
      id: "steered",
      role: "user",
      parts: [{ type: "text", text: "Steered prompt" }],
      sender: { type: "user", id: "steering", name: "Steering person", requestId: "steering-request" },
    };
    coordination = withSchedulingLock(async () => {
      if (kind === "concurrent") await persistSessionMessages(session.id, [message, steered], app.deps);
      if (kind === "unconfirmed-change")
        await persistSessionMessages(session.id, [{ ...message, sender: undefined }, steered], app.deps);
    });
    const progressed = await Promise.race([
      coordination.then(() => true),
      new Promise<false>((resolve) => {
        deadline = setTimeout(() => resolve(false), 1000);
      }),
    ]);
    clearTimeout(deadline);
    release.resolve([message]);
    await Promise.all([recovery, coordination]);
    expect(progressed).toBe(true);
    expect(providerReads).toBe(kind === "saved" ? 0 : 1);
    const saved = (await app.deps.sessionService.get(session.id))!;
    const file = (await app.deps.fileService.get(saved.session_file_id!))!;
    const savedMessages = await Bun.file(file.storage_path).json();
    if (kind === "unconfirmed-change") {
      expect(savedMessages).toEqual([{ id: message.id, role: message.role, parts: message.parts }, steered]);
      expect(await app.deps.sessionQueueEntriesService.get(entry.queue_position)).toEqual(dispatch);
    } else {
      expect(savedMessages).toEqual(kind === "concurrent" ? [message, steered] : [message]);
      expect(await app.deps.sessionQueueEntriesService.get(entry.queue_position)).toBeNull();
    }
  } finally {
    clearTimeout(deadline);
    release.resolve([]);
    await Promise.allSettled([recovery, coordination]);
    await app.close();
  }
});
