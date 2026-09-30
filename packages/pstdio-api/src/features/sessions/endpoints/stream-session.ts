import type { JsonPatch, SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "../deps";
import { getSessionHistory, SessionNotFoundError } from "../session-history";
import type { ActiveSession } from "../session-store";
import type { SessionEventSink } from "../session-stream-connections";
import { createStreamQueuePublisher } from "./stream-session-queue";

const snapshot = (messages: SessionMessage[], sink: SessionEventSink) =>
  sink.write("patch", { op: "replace", path: "/messages", value: messages });
const isTerminal = (status?: string | null) =>
  ["completed", "failed", "cancelled", "disconnected"].includes(status ?? "");

// Waits wake every second so an unsubscribed or replaced run stops promptly.
const withinTick = async <T>(pending: Promise<T>) => {
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
  sink: SessionEventSink,
  queue: ReturnType<typeof createStreamQueuePublisher>,
) => {
  let aborted = false;
  const iterator = patches[Symbol.asyncIterator]();
  sink.onAbort(() => {
    aborted = true;
    void iterator.return?.();
  });
  let next: Promise<IteratorResult<JsonPatch>> | undefined;
  try {
    while (!aborted) {
      next ??= iterator.next();
      const item = await withinTick(next);
      if (aborted) break;
      if (!item) continue;
      next = undefined;
      if (item.done) break;
      const patch = item.value;
      await queue.beforePatch(patch);
      const approval = patch.path === "/approval_request";
      await sink.write(approval ? "approval_request" : "patch", approval ? patch.value : patch);
    }
    return aborted;
  } finally {
    await iterator.return?.();
  }
};

const waitForEntry = async (id: string, deps: SessionsRouteDeps, sink: SessionEventSink, previous?: ActiveSession) => {
  // The run status is published before its owner. Native history from an earlier
  // run does not mean the new run is ready, and must not end this subscription.
  while (!sink.aborted) {
    const entry = deps.sessionService.store.get(id);
    if (entry && entry !== previous) return entry;
    const current = await deps.sessionService.get(id);
    if (!current) return null;
    if (isTerminal(current.status)) {
      if (!previous || !(await deps.sessionQueueEntriesService.listPendingBySession(id)).length) return null;
    }
    await sink.sleep(previous ? 200 : 500);
  }
  return null;
};

const streamEntry = async (id: string, entry: ActiveSession, deps: SessionsRouteDeps, sink: SessionEventSink) => {
  while (!sink.aborted) {
    const conversation = await withinTick(entry.conversationReady).catch((error) => {
      if (deps.sessionService.store.get(id) !== entry) return null;
      throw error;
    });
    if (deps.sessionService.store.get(id) !== entry) return false;
    if (!conversation) continue;
    const current = conversation.snapshotAndSubscribe();
    const queue = createStreamQueuePublisher(id, deps, sink);
    const iterator = current.stream[Symbol.asyncIterator]();
    try {
      await queue.snapshot(current.messages);
      await snapshot(current.messages, sink);
      return await streamLivePatches({ [Symbol.asyncIterator]: () => iterator }, sink, queue);
    } finally {
      await iterator.return?.();
    }
  }
  return true;
};

const sendInactiveSnapshot = async (id: string, deps: SessionsRouteDeps, sink: SessionEventSink) => {
  const history = await getSessionHistory(id, deps).catch((error) => {
    if (error instanceof SessionNotFoundError) return null;
    throw error;
  });
  if (!history) return null;
  const entry = deps.sessionService.store.get(id);
  if (entry) return entry;
  await createStreamQueuePublisher(id, deps, sink).snapshot(history);
  const next = deps.sessionService.store.get(id);
  if (next) return next;
  await snapshot(history, sink);
  return null;
};

export const streamSession = async (id: string, deps: SessionsRouteDeps, sink: SessionEventSink) => {
  await sink.write("ready", { sessionId: id });
  let entry = deps.sessionService.store.get(id) ?? (await waitForEntry(id, deps, sink));
  if (!entry) entry = await sendInactiveSnapshot(id, deps, sink);
  while (entry) {
    if (await streamEntry(id, entry, deps, sink)) return;
    entry = await waitForEntry(id, deps, sink, entry);
  }
  const session = await deps.sessionService.get(id);
  await sink.write("end", { status: session?.status ?? "unknown" });
};
