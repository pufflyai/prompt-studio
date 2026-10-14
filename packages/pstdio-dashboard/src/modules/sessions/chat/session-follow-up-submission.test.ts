import { beforeEach, expect, test } from "bun:test";
import type { PendingQueuedFollowUpsResponse } from "@pstdio/sdk/api";
import type { SessionStreamHandlers } from "@pstdio/sdk/client";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createRendererReadRegistry } from "@pstdio/workbench";
import { createSessionHistoryController, type SessionHistoryState } from "../data/session-history-controller";
import { serverShowsPendingFollowUp, splitQueuedFollowUps } from "./queued-follow-ups";
import { type FollowUpMutation, submitSessionMessage } from "./session-chat-actions";
import { getPendingFollowUp, mergeMessagesWithPendingFollowUp, updatePendingFollowUp } from "./session-chat-state";

type FollowUpResult = Awaited<ReturnType<FollowUpMutation["mutateAsync"]>>;

const deferred = () => {
  let resolve!: (result: FollowUpResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<FollowUpResult>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const current = () => getPendingFollowUp("session-1");
const submission = (
  followUp: FollowUpMutation,
  onSubmitted: () => void,
  answers?: string[][],
  sessionStatus = "completed",
  history: {
    messages?: SessionMessage[];
    reconnect?: () => void;
    refreshQueue?: () => Promise<PendingQueuedFollowUpsResponse | undefined>;
  } = {},
) =>
  submitSessionMessage({
    conversationKey: "session-1",
    sessionId: "session-1",
    sessionStatus,
    projectId: "project-1",
    agent: "codex",
    model: "model-1",
    text: "Next turn",
    messages: history.messages ?? [],
    createSession: { mutateAsync: () => Promise.reject(new Error("Must use existing session")) },
    followUp,
    reconnect: history.reconnect ?? (() => undefined),
    refreshQueue: history.refreshQueue ?? (() => new Promise(() => undefined)),
    onSubmitted,
    questionResponse: answers ? { answers } : undefined,
  });
const savedPrompt = (position: number) => ({
  messages: [
    {
      id: `queued-prompt-session-1-${position}`,
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Next turn" }],
    },
  ],
  queue: {
    requests: [
      {
        queuePosition: position,
        revision: "saved",
        prompt: "Next turn",
        steeringDelivery: null,
        model: null,
        params: {},
        attachments: [],
      },
    ],
    activeRunStartedAt: "run",
    steeringAvailable: false,
    steeringUnavailableReason: null,
  } satisfies PendingQueuedFollowUpsResponse,
});

beforeEach(() => updatePendingFollowUp("session-1", null));

test.each([
  "in_progress",
  "awaiting_input",
  "queued",
])("a follow-up submitted to an %s session appears only in the queue while sending", (status) => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined, undefined, status);
  const display = splitQueuedFollowUps(
    mergeMessagesWithPendingFollowUp([], current()),
    "session-1",
    undefined,
    current(),
  );
  expect(display.messages).toEqual([]);
  expect(display.queuedFollowUps).toEqual([
    expect.objectContaining({ id: current()?.userMessageId, prompt: "Next turn", sending: true }),
  ]);
});

test("a failed queued submission remains recoverable in the conversation", async () => {
  await submission(
    { mutateAsync: () => Promise.reject(new TypeError("Failed to fetch")) },
    () => undefined,
    undefined,
    "in_progress",
  );
  const display = splitQueuedFollowUps(
    mergeMessagesWithPendingFollowUp([], current()),
    "session-1",
    undefined,
    current(),
  );
  expect(display.queuedFollowUps).toEqual([]);
  expect(display.messages).toEqual([expect.objectContaining({ role: "user", delivery: "unsent" })]);
});

test("a follow-up goes to the conversation when the server dispatches it after active work finishes", async () => {
  const response = deferred();
  const sent = submission({ mutateAsync: () => response.promise }, () => undefined, undefined, "in_progress");
  response.resolve({ status: "in_progress", followUp: { status: "dispatched" } });
  await sent;
  const display = splitQueuedFollowUps(
    mergeMessagesWithPendingFollowUp([], current()),
    "session-1",
    undefined,
    current(),
  );
  expect(display.queuedFollowUps).toEqual([]);
  expect(display.messages.map((message) => message.parts[0])).toEqual([
    { type: "text", text: "Next turn" },
    { type: "loading" },
  ]);
});

test("a saved queue snapshot replaces a sending follow-up before its response arrives", () => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined, undefined, "in_progress");
  const saved = [
    { id: "queued-prompt-session-1-2", role: "user" as const, parts: [{ type: "text" as const, text: "Next turn" }] },
  ];
  const display = splitQueuedFollowUps(
    mergeMessagesWithPendingFollowUp(saved, current()),
    "session-1",
    undefined,
    current(),
  );
  expect(display.messages).toEqual([]);
  expect(display.queuedFollowUps).toEqual([expect.objectContaining({ id: saved[0].id, position: 2 })]);
});

test("hands off the draft immediately but waits for server acceptance before completing", async () => {
  const response = deferred();
  let submitted = false;
  const result = submission(
    {
      mutateAsync: (input) => {
        expect(input).toMatchObject({ sessionId: "session-1", prompt: "Next turn", agent: "codex", model: "model-1" });
        return response.promise;
      },
    },
    () => {
      submitted = true;
    },
  );
  expect(submitted).toBe(true);
  expect(current()?.prompt).toBe("Next turn");
  let settled = false;
  void result.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  response.resolve({ status: "in_progress", followUp: { status: "queued", queue_position: 1 } });
  await result;
  expect(submitted).toBe(true);
});

test("a follow-up shows in the conversation while it is being sent", () => {
  const beforeSubmission = Date.now();
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  expect(current()?.submittedAt).toBeGreaterThanOrEqual(beforeSubmission);
  expect(current()?.submittedAt).toBeLessThanOrEqual(Date.now());
  expect(mergeMessagesWithPendingFollowUp([], current()).map((message) => message.parts[0])).toEqual([
    { type: "text", text: "Next turn" },
    { type: "loading" },
  ]);
});

test("a follow-up that cannot be sent stays in the conversation as unsent", async () => {
  let submitted = false;
  await submission({ mutateAsync: () => Promise.reject(new TypeError("Failed to fetch")) }, () => {
    submitted = true;
  });
  expect(submitted).toBe(true);
  expect(current()?.failure).toEqual({ message: "The network is unavailable.", temporary: true });
  expect(mergeMessagesWithPendingFollowUp([], current())).toEqual([
    expect.objectContaining({ role: "user", delivery: "unsent", parts: [{ type: "text", text: "Next turn" }] }),
  ]);
});

const queuedAnswer: FollowUpMutation = {
  mutateAsync: async () => ({ status: "in_progress", followUp: { status: "queued", queue_position: 2 } }),
};
const shownRows = (messages: SessionMessage[]) =>
  splitQueuedFollowUps(mergeMessagesWithPendingFollowUp(messages, current()), "session-1", undefined, current())
    .queuedFollowUps;

test("a follow-up the server queues stays in the queue until the queue list shows its saved request", async () => {
  await submission(queuedAnswer, () => undefined);
  const pending = current()!;
  expect(shownRows([])).toEqual([expect.objectContaining({ prompt: "Next turn", sending: true })]);
  expect(serverShowsPendingFollowUp([], "session-1", pending, null)).toBe(false);
  expect(serverShowsPendingFollowUp(savedPrompt(2).messages, "session-1", pending, null)).toBe(true);
});

test.each([
  ["the queue read after the answer lists it", savedPrompt(2).queue, true],
  ["no queue snapshot follows the answer", undefined, true],
  ["the queue read after the answer no longer lists it", { ...savedPrompt(2).queue, requests: [] }, false],
])("a queued follow-up stays only while it is still queued: %s", async (_label, queue, kept) => {
  await submission(queuedAnswer, () => undefined, undefined, "in_progress", { refreshQueue: async () => queue });
  await Promise.resolve();
  expect(current() !== null).toBe(kept);
});

test("a queued follow-up that runs before the queue list shows it leaves once its run shows it", async () => {
  await submission(queuedAnswer, () => undefined, undefined, "in_progress");
  const pending = { ...current()!, previousRunStarted: "run-1" };
  const ran = [{ id: "native-user", role: "user" as const, parts: [{ type: "text" as const, text: "Next turn" }] }];
  expect(serverShowsPendingFollowUp(ran, "session-1", pending, "run-1")).toBe(false);
  expect(serverShowsPendingFollowUp(ran, "session-1", pending, "run-2")).toBe(true);
});

test("a follow-up queued during active work stays visible until the queue list shows its saved request", async () => {
  const reads = createRendererReadRegistry();
  type QueueRead = { messages: SessionMessage[]; queue?: PendingQueuedFollowUpsResponse };
  const queueReads: ReturnType<typeof Promise.withResolvers<QueueRead>>[] = [];
  const streams: SessionStreamHandlers[] = [];
  let state!: SessionHistoryState;
  const controller = createSessionHistoryController({
    sessionId: "session-1",
    ownerKey: "view",
    reads,
    initialSession: { id: "session-1", status: "in_progress", last_request_started: "run" },
    transport: {
      getConversation: async () => ({ messages: [] }),
      getQueuedMessages: (_id, options) => {
        const read = Promise.withResolvers<QueueRead>();
        options?.signal?.addEventListener("abort", () => read.reject(options.signal?.reason));
        queueReads.push(read);
        return read.promise;
      },
      connectStream: (_id, handlers) => {
        streams.push(handlers);
        return { close() {} };
      },
    },
    onChange: (next) => {
      state = next;
    },
  });
  const tick = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  const rows = () =>
    splitQueuedFollowUps(state.messages, "session-1", state.queue, current()).queuedFollowUps.map((item) => ({
      prompt: item.prompt,
      position: item.position,
      sending: Boolean(item.sending),
    }));
  controller.connect();
  streams[0]!.onReady!({});
  await tick();
  queueReads[0]!.resolve({ messages: [] });
  await tick();
  const response = deferred();
  const sent = submission({ mutateAsync: () => response.promise }, () => undefined, undefined, "in_progress", {
    messages: state.messages,
    reconnect: controller.connect,
    refreshQueue: controller.refreshQueue,
  });
  response.resolve({ status: "in_progress", followUp: { status: "queued", queue_position: 3 } });
  await sent;
  await tick();
  expect(rows()).toEqual([{ prompt: "Next turn", position: undefined, sending: true }]);
  // The stream publishes the saved request and replaces the queue read that would confirm it.
  streams[0]!.onQueuedMessages!(savedPrompt(3));
  await tick();
  expect(rows()).toEqual([{ prompt: "Next turn", position: 3, sending: false }]);
  expect(serverShowsPendingFollowUp(state.messages, "session-1", current()!, "run")).toBe(true);
  expect(streams).toHaveLength(1);
  controller.dispose();
  await reads.dispose();
});

test("an accepted question answer clears its pending submission without a new user turn", async () => {
  const response = deferred();
  let submitted = false;
  const result = submission({ mutateAsync: () => response.promise }, () => {
    submitted = true;
  }, [["Blue"]]);
  expect(submitted).toBe(false);
  response.resolve({ status: "in_progress", followUp: { status: "dispatched" } });
  await result;
  expect(submitted).toBe(true);
  expect(current()).toBeNull();
});

test("a rejected question reply preserves the form for retry", async () => {
  let submitted = false;
  const result = submission({ mutateAsync: () => Promise.reject(new Error("Native reply rejected")) }, () => {
    submitted = true;
  }, [["Blue"]]);
  await expect(result).rejects.toThrow("Native reply rejected");
  expect(submitted).toBe(false);
  expect(current()?.failure).toBeDefined();
});

test("shows an accepted follow-up once while its run timestamp is still syncing", () => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  const accepted = [{ id: "accepted", role: "user" as const, parts: [{ type: "text" as const, text: "Next turn" }] }];
  expect(mergeMessagesWithPendingFollowUp(accepted, current())).toEqual(accepted);
});

test("assistant messages arriving during submission keep the pending user turn visible", () => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  const streaming = [
    { id: "streaming", role: "assistant" as const, parts: [{ type: "text" as const, text: "Still working" }] },
  ];
  expect(mergeMessagesWithPendingFollowUp(streaming, current())).toHaveLength(3);
  expect(mergeMessagesWithPendingFollowUp(streaming, current())[1].parts).toEqual([
    { type: "text", text: "Next turn" },
  ]);
});

test("another user turn does not acknowledge a different pending submission", () => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  const other = [{ id: "other", role: "user" as const, parts: [{ type: "text" as const, text: "A different turn" }] }];
  expect(mergeMessagesWithPendingFollowUp(other, current())).toHaveLength(3);
});

test("a session follow-up belongs only to its own session", () => {
  void submission({ mutateAsync: () => deferred().promise }, () => undefined);
  expect(current()?.prompt).toBe("Next turn");
  expect(getPendingFollowUp("session-2")).toBeNull();
  expect(getPendingFollowUp("draft")).toBeNull();
});
