import type { SessionsRouteDeps } from "../deps";
import type { SessionEventSink } from "../session-stream-connections";

/** Reading a synced conversation never attaches a local harness to the source device's session. */
export const streamPersonalSession = async (id: string, deps: SessionsRouteDeps, sink: SessionEventSink) => {
  if (await deps.sessionService.get(id)) return false;
  let session = await deps.personalHistoryService.getSession(id);
  if (!session) return false;
  let previous: string | undefined;
  while (!sink.aborted && session?.project_id) {
    const messages = await deps.personalHistoryService.messages(id, session.project_id);
    if (!messages) break;
    const value = JSON.stringify(messages);
    if (value !== previous) {
      await sink.write("patch", { op: "replace", path: "/messages", value: messages });
      previous = value;
    }
    if (["completed", "failed", "cancelled", "disconnected"].includes(session.status)) break;
    await sink.sleep(500);
    session = await deps.personalHistoryService.getSession(id);
  }
  if (!sink.aborted) await sink.write("end", { status: session?.status ?? "unknown" });
  return true;
};
