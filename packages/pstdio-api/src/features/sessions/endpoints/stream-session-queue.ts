import type { JsonPatch, SessionMessage, SessionQueuedMessagesResponse } from "pstdio-api-contracts";
import { sessionLogger } from "../../../lib/logger";
import type { SessionsRouteDeps } from "../deps";
import { pendingQueuedRequests } from "../pending-queued-requests";
import { queuedMessagesFromRequests } from "../queued-session-messages";
import type { SessionEventSink } from "../session-stream-connections";

// Queue positions are authoritative. Matching prompt text would retire the wrong
// occurrence when a user queues the same prompt more than once.
export const createStreamQueuePublisher = (id: string, deps: SessionsRouteDeps, sink: SessionEventSink) => {
  let userIds = new Set<string>();
  const send = async () => {
    let data: SessionQueuedMessagesResponse | { error: string };
    try {
      const session = await deps.sessionService.get(id);
      const queue = await pendingQueuedRequests(deps, id);
      data = {
        messages: session?.project_id
          ? await queuedMessagesFromRequests(deps, session.project_id, id, queue.requests)
          : [],
        queue,
      };
    } catch {
      data = { error: "Could not refresh queued messages" };
    }
    await sink.write("queued_messages", data);
  };
  // One snapshot at a time. Changes during a send trigger one more send, read after them,
  // so the last snapshot sent is current and a burst of changes costs at most two reads.
  let sending: Promise<void> | undefined;
  let changed = false;
  const sendChanges = async () => {
    while (changed) {
      changed = false;
      await send().catch((error) => {
        sessionLogger.error(
          { err: error, event: "session.stream.queue_failed", session_id: id },
          "Could not publish queued messages",
        );
      });
    }
    sending = undefined;
  };
  const publish = () => {
    changed = true;
    sending ??= sendChanges();
    return sending;
  };
  // Every queue mutation publishes its session row after it commits (session-queue-service).
  // The stream republishes on every row event, so it also covers changes while no run is attached.
  const unsubscribe = deps.eventBus.subscribe((event) => {
    if (event.table === "sessions" && (event.data as { id?: string }).id === id) void publish();
  });
  return {
    async snapshot(messages: SessionMessage[]) {
      userIds = new Set(messages.filter((message) => message.role === "user").map((message) => message.id));
      await publish();
    },
    async beforePatch(patch: JsonPatch) {
      let users: SessionMessage[] = [];
      if (patch.path === "/messages" && Array.isArray(patch.value)) users = patch.value;
      else if (/^\/messages\/\d+$/.test(patch.path) && patch.op !== "remove") users = [patch.value as SessionMessage];
      users = users.filter((message) => message.role === "user");
      const added = users.some((message) => !userIds.has(message.id));
      if (patch.path === "/messages") userIds = new Set();
      for (const message of users) userIds.add(message.id);
      if (added) await publish();
    },
    async close() {
      unsubscribe();
      await sending;
    },
  };
};

export type StreamQueuePublisher = ReturnType<typeof createStreamQueuePublisher>;
