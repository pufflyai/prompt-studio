import type { SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "../deps";
import type { SessionEventSink } from "../session-stream-connections";

const finished = ["completed", "failed", "cancelled", "disconnected"];

/**
 * Reading a synced conversation never attaches a local harness to the source device's session. The reader gets
 * the saved conversation once, then only the messages that arrive or stream from the other device.
 */
export const streamPersonalSession = async (id: string, deps: SessionsRouteDeps, sink: SessionEventSink) => {
  if (await deps.sessionService.get(id)) return false;
  let session = await deps.personalHistoryService.getSession(id);
  if (!session?.project_id) return false;
  const projectId = session.project_id;
  const arrived: { index: number; message: SessionMessage; live: boolean }[] = [];
  let wake: (() => void) | undefined;
  const stop = deps.personalHistoryService.watchMessages(id, (update) => {
    arrived.push(update);
    wake?.();
  });
  try {
    let messages = (await deps.personalHistoryService.messages(id, projectId)) ?? [];
    await sink.write("patch", { op: "replace", path: "/messages", value: messages });
    let pendingLive: (typeof arrived)[number] | undefined;
    const apply = async ({ index, message, live }: (typeof arrived)[number]) => {
      if (sink.aborted || !(await deps.personalHistoryService.getSession(id))) return;
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
      for (const update of arrived.splice(0)) await apply(update);
      if (pendingLive?.index === messages.length) {
        arrived.unshift(pendingLive);
        pendingLive = undefined;
        await flush();
      }
    };
    while (!sink.aborted) {
      if (!(await deps.personalHistoryService.getSession(id))) break;
      await flush();
      if (sink.aborted || finished.includes(session?.status ?? "")) break;
      await Promise.race([sink.sleep(2000), new Promise<void>((resolve) => (wake = resolve))]);
      wake = undefined;
      session = await deps.personalHistoryService.getSession(id);
    }
  } finally {
    stop();
  }
  if (!sink.aborted) await sink.write("end", { status: session?.status ?? "unknown" });
  return true;
};
