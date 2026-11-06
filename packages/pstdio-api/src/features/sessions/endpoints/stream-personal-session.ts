import type { SessionMessage } from "pstdio-api-contracts";
import { sessionLogVersion } from "../../../services/personal-history/log-publication";
import type { SessionsRouteDeps } from "../deps";
import type { SessionEventSink } from "../session-stream-connections";

const finished = ["completed", "failed", "cancelled", "disconnected"];

/**
 * Reading a synced conversation never attaches a local harness to the source device's session. The reader gets
 * the saved conversation, arriving updates, and a final durable snapshot after completion catches up.
 */
export const streamPersonalSession = async (id: string, deps: SessionsRouteDeps, sink: SessionEventSink) => {
  if (await deps.sessionService.get(id)) return false;
  let session = await deps.personalHistoryService.getSession(id);
  if (!session?.project_id) return false;
  const projectId = session.project_id;
  type Update = { index: number; message: SessionMessage; live: boolean };
  const arrived = new Map<number, Update>();
  let wake: (() => void) | undefined;
  const stop = deps.personalHistoryService.watchMessages(
    id,
    (update) => {
      arrived.set(update.index, update);
      wake?.();
    },
    projectId,
  );
  // The session row changes whenever its device changes the queue, so a row event marks the queue
  // for another read. The flag also covers events that arrive while the reader is busy.
  let queueChanged = true;
  const unsubscribe = deps.eventBus.subscribe((event) => {
    if (event.table !== "sessions" || (event.data as { id?: string }).id !== id) return;
    queueChanged = true;
    wake?.();
  });
  let sentQueue: string | undefined;
  let sentApprovals: string | undefined;
  const sendApprovals = async () => {
    const current = await deps.personalHistoryService.getSession(id, projectId);
    if (!current || sink.aborted) return;
    const requests = current.approval_requests ?? [];
    const next = JSON.stringify(requests);
    if (next === sentApprovals || sink.aborted) return;
    sentApprovals = next;
    await sink.write("patch", { op: "replace", path: "/approval_requests", value: requests });
  };
  const sendQueue = async () => {
    if (!queueChanged) return;
    queueChanged = false;
    const shared = await deps.personalHistoryService.queuedMessages(id, projectId);
    if (!shared || sink.aborted) return;
    const value = JSON.stringify(shared);
    if (value === sentQueue) return;
    sentQueue = value;
    await sink.write("queued_messages", shared);
  };
  try {
    let messages = (await deps.personalHistoryService.messages(id, projectId)) ?? [];
    await sink.write("patch", { op: "replace", path: "/messages", value: messages });
    await sendQueue();
    await sendApprovals();
    let pendingLive: Update | undefined;
    const apply = async ({ index, message, live }: Update) => {
      if (sink.aborted || !(await deps.personalHistoryService.getSession(id, projectId))) return;
      // A streaming preview can be ahead of the last saved message; the saved messages arrive in order.
      if (live && index > messages.length) {
        pendingLive = { index, message, live };
        return;
      }
      if (!live && pendingLive?.index === index) pendingLive = undefined;
      if (index > messages.length) {
        // A message arrived before an earlier one this reader has; show the saved conversation again.
        messages = (await deps.personalHistoryService.messages(id, projectId)) ?? [];
        await sink.write("patch", { op: "replace", path: "/messages", value: messages });
        return;
      }
      const op = index < messages.length ? "replace" : "add";
      messages[index] = message;
      await sink.write("patch", { op, path: `/messages/${index}`, value: message });
    };
    const flush = async () => {
      while (arrived.size) {
        for (const index of arrived.keys()) {
          const update = arrived.get(index)!;
          arrived.delete(index);
          await apply(update);
        }
        if (pendingLive?.index === messages.length) {
          if (!arrived.has(pendingLive.index)) arrived.set(pendingLive.index, pendingLive);
          pendingLive = undefined;
        }
      }
    };
    const complete = async () => {
      if (!session || !finished.includes(session.status)) return false;
      const version = sessionLogVersion(session);
      if (!(await deps.personalHistoryService.messagesReady(id, projectId, version))) return false;
      await flush();
      // A page commits before its watcher runs; the final snapshot must use that committed page.
      const final = await deps.personalHistoryService.messages(id, projectId);
      if (!final || sink.aborted) return sink.aborted;
      messages = final;
      await sink.write("patch", { op: "replace", path: "/messages", value: messages });
      return await deps.personalHistoryService.messagesReady(id, projectId, version);
    };
    while (!sink.aborted) {
      if (!(await deps.personalHistoryService.getSession(id, projectId))) break;
      await flush();
      await sendQueue();
      await sendApprovals();
      if (sink.aborted) break;
      if (await complete()) break;
      if (!arrived.size && !queueChanged) {
        // The queue record can sync in a later round than its session row, so a quiet reader checks it again.
        const timedOut = await Promise.race([
          sink.sleep(2000).then(() => true),
          new Promise<boolean>((resolve) => (wake = () => resolve(false))),
        ]);
        if (timedOut) queueChanged = true;
      }
      wake = undefined;
      session = await deps.personalHistoryService.getSession(id, projectId);
    }
  } finally {
    stop();
    unsubscribe();
  }
  if (!sink.aborted) await sink.write("end", { status: session?.status ?? "unknown" });
  return true;
};
