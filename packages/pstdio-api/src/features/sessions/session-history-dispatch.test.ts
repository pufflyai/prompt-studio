import { expect, test } from "bun:test";
import type { HarnessExit, SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { getSessionMessages } from "./get-session-messages";
import { initializeConversation } from "./initialize-conversation";
import { getSessionHistory, SessionHistoryError } from "./session-history";
import { persistSessionMessages } from "./session-messages";
import { createSessionScheduler } from "./session-scheduler";
import { logStartupFailure } from "./session-startup-failure";

const saved: SessionMessage[] = [
  { id: "user", role: "user", parts: [{ type: "text", text: "Question" }] },
  { id: "reply", role: "assistant", parts: [{ type: "text", text: "Saved answer" }] },
];

const setup = async (native: () => SessionMessage[]) => {
  const record = createTestHarnessRecord("history", {
    provider: {
      getMessages: native,
      start: () => ({ done: new Promise<HarnessExit>(() => {}), stop: () => {} }),
    },
  });
  const handle = await createTestApp({ harnessRegistry: createTestHarnessRegistry([record]) });
  const project = await handle.deps.projectService.create({ name: "History dispatch" });
  const session = await handle.deps.sessionService.create({
    project_id: project.id,
    title: "History",
    agent: testHarnessId("history"),
    status: "completed",
  });
  await handle.deps.sessionService.update(session.id, { agent_session_id: "thread" });
  await persistSessionMessages(session.id, saved, handle.deps);
  return { handle, session: (await handle.deps.sessionService.get(session.id))! };
};

const conflicting = () => [saved[0], { ...saved[1], parts: [{ type: "text" as const, text: "Other answer" }] }];

test("history conflicts reject follow-ups before capacity queues them", async () => {
  const { handle, session } = await setup(conflicting);
  try {
    await handle.deps.settingsService.update({ max_concurrent_sessions: 1 });
    await handle.deps.sessionService.create({ project_id: session.project_id!, title: "Busy", agent: "test" });
    await expect(
      createSessionScheduler(handle.deps).startOrQueueExisting({
        session,
        prompt: "Keep this prompt",
        respectCapacity: true,
      }),
    ).rejects.toBeInstanceOf(SessionHistoryError);
    expect(await handle.deps.sessionService.get(session.id)).toEqual(session);
    expect(await handle.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toEqual([]);
  } finally {
    await handle.close();
  }
});

test("queued history conflicts preserve the pending prompt and allow other sessions to drain", async () => {
  const { handle, session } = await setup(conflicting);
  try {
    const queued = await handle.deps.sessionService.queueExistingWithEntry({
      id: session.id,
      prompt: "Keep this prompt",
      request_kind: "follow_up",
    });
    const other = await handle.deps.sessionService.createQueuedWithEntry({
      project_id: session.project_id!,
      title: "Ready to start",
      agent: session.agent!,
      prompt: "Another prompt",
      request_kind: "start",
    });
    await createSessionScheduler(handle.deps).drainQueue();
    expect((await handle.deps.sessionService.get(session.id))?.status).toBe("queued");
    expect(await handle.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toEqual([queued.entry!]);
    expect((await getSessionHistory(session.id, handle.deps)).historyIssue?.code).toBe("reconciliation_conflict");
    expect((await handle.deps.sessionService.get(other.id))?.status).toBe("in_progress");
  } finally {
    await handle.close();
  }
});

test("active recovered history retains the unavailable native source warning", async () => {
  const { handle, session } = await setup(() => {
    throw new Error("Native history unavailable");
  });
  try {
    const entry = initializeConversation(session.id, handle.deps, async () => {});
    await entry.conversationReady;
    expect(await getSessionHistory(session.id, handle.deps)).toEqual({
      messages: saved,
      historyIssue: { code: "native_unavailable", category: "native_unavailable" },
    });
    expect((await entry.conversationReady).snapshotAndSubscribe().historyIssue?.code).toBe("native_unavailable");
  } finally {
    await handle.close();
  }
});

test("summary history treats a deleted session as empty", async () => {
  const handle = await createTestApp();
  try {
    expect(await getSessionMessages("deleted-session", handle.deps)).toEqual([]);
  } finally {
    await handle.close();
  }
});

test("a history conflict during startup restores the accepted queue entry", async () => {
  const { handle, session } = await setup(conflicting);
  try {
    const { entry } = await handle.deps.sessionService.queueExistingWithEntry({
      id: session.id,
      prompt: "Accepted prompt",
      request_kind: "follow_up",
    });
    const claimed = await handle.deps.sessionService.claimQueuedForDispatch(session.id, entry!.queue_position);
    await logStartupFailure(handle.deps, {
      session: claimed!,
      agentId: session.agent!,
      submittedQueuePosition: entry!.queue_position,
      error: new SessionHistoryError({ code: "reconciliation_conflict", category: "conflicting_order" }),
    });
    expect((await handle.deps.sessionService.get(session.id))?.status).toBe("queued");
    expect(
      (await handle.deps.sessionQueueEntriesService.listPendingBySession(session.id)).map((item) => item.prompt),
    ).toEqual(["Accepted prompt"]);
  } finally {
    await handle.close();
  }
});
