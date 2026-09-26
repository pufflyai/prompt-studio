import type { Context } from "hono";
import type { SSEStreamingApi } from "hono/streaming";
import { streamSSE } from "hono/streaming";
import type { JsonPatch, SessionMessage } from "pstdio-api-contracts";
import type { AppBindings } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { getSessionHistory, SessionNotFoundError } from "../session-history";
import type { ActiveSession } from "../session-store";
import { createStreamQueuePublisher } from "./stream-session-queue";

const heartbeat = (stream: SSEStreamingApi) =>
  stream.writeSSE({ data: JSON.stringify({ timestamp: Date.now() }), event: "heartbeat" });
const snapshot = (messages: SessionMessage[], stream: SSEStreamingApi) =>
  stream.writeSSE({ data: JSON.stringify({ op: "replace", path: "/messages", value: messages }), event: "patch" });
const isTerminal = (status?: string | null) =>
  ["completed", "failed", "cancelled", "disconnected"].includes(status ?? "");

const withHeartbeat = async <T>(pending: Promise<T>) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const streamLivePatches = async (
  patches: AsyncIterable<JsonPatch>,
  stream: SSEStreamingApi,
  queue: ReturnType<typeof createStreamQueuePublisher>,
) => {
  let aborted = false;
  const iterator = patches[Symbol.asyncIterator]();
  stream.onAbort(() => {
    aborted = true;
    void iterator.return?.();
  });
  let next: Promise<IteratorResult<JsonPatch>> | undefined;
  try {
    while (!aborted) {
      next ??= iterator.next();
      const item = await withHeartbeat(next);
      if (aborted) break;
      if (!item) {
        await heartbeat(stream);
        continue;
      }
      next = undefined;
      if (item.done) break;
      const patch = item.value;
      await queue.beforePatch(patch);
      const event = patch.path === "/history_issue" ? "history_issue" : "patch";
      await stream.writeSSE({
        data: JSON.stringify(
          patch.path === "/approval_request" || patch.path === "/history_issue" ? patch.value : patch,
        ),
        event: patch.path === "/approval_request" ? "approval_request" : event,
      });
    }
    return aborted;
  } finally {
    await iterator.return?.();
  }
};

const waitForEntry = async (id: string, deps: SessionsRouteDeps, stream: SSEStreamingApi, previous?: ActiveSession) => {
  // The run status is published before its owner. Native history from an earlier
  // run does not mean the new run is ready, and must not end this subscription.
  while (!stream.aborted) {
    const entry = deps.sessionService.store.get(id);
    if (entry && entry !== previous) return entry;
    const current = await deps.sessionService.get(id);
    if (!current) return null;
    if (isTerminal(current.status)) {
      if (!previous || !(await deps.sessionQueueEntriesService.listPendingBySession(id)).length) return null;
    }
    await heartbeat(stream);
    await stream.sleep(previous ? 200 : 500);
  }
  return null;
};

const streamEntry = async (id: string, entry: ActiveSession, deps: SessionsRouteDeps, stream: SSEStreamingApi) => {
  while (!stream.aborted) {
    const conversation = await withHeartbeat(entry.conversationReady).catch((error) => {
      if (deps.sessionService.store.get(id) !== entry) return null;
      throw error;
    });
    if (deps.sessionService.store.get(id) !== entry) return false;
    if (!conversation) {
      await heartbeat(stream);
      continue;
    }
    const current = conversation.snapshotAndSubscribe();
    const queue = createStreamQueuePublisher(id, deps, stream);
    const iterator = current.stream[Symbol.asyncIterator]();
    try {
      await queue.snapshot(current.messages);
      await snapshot(current.messages, stream);
      if (current.historyIssue)
        await stream.writeSSE({ data: JSON.stringify(current.historyIssue), event: "history_issue" });
      return await streamLivePatches({ [Symbol.asyncIterator]: () => iterator }, stream, queue);
    } finally {
      await iterator.return?.();
    }
  }
  return true;
};

const sendInactiveSnapshot = async (id: string, deps: SessionsRouteDeps, stream: SSEStreamingApi) => {
  const history = await getSessionHistory(id, deps).catch((error) => {
    if (error instanceof SessionNotFoundError) return null;
    throw error;
  });
  if (!history) return null;
  const entry = deps.sessionService.store.get(id);
  if (entry) return entry;
  await createStreamQueuePublisher(id, deps, stream).snapshot(history.messages);
  const next = deps.sessionService.store.get(id);
  if (next) return next;
  await snapshot(history.messages, stream);
  if (history.historyIssue)
    await stream.writeSSE({ data: JSON.stringify(history.historyIssue), event: "history_issue" });
  return null;
};

export const streamSessionHandler = (deps: SessionsRouteDeps) => (c: Context<AppBindings>) => {
  const id = c.req.param("id")!;
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ data: JSON.stringify({ sessionId: id }), event: "ready" });
    let entry = deps.sessionService.store.get(id) ?? (await waitForEntry(id, deps, stream));
    if (!entry) entry = await sendInactiveSnapshot(id, deps, stream);
    while (entry) {
      if (await streamEntry(id, entry, deps, stream)) return;
      entry = await waitForEntry(id, deps, stream, entry);
    }
    const session = await deps.sessionService.get(id);
    await stream.writeSSE({ data: JSON.stringify({ status: session?.status ?? "unknown" }), event: "end" });
  });
};
