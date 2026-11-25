import { Buffer } from "node:buffer";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { apiLogger } from "../../lib/logger";
import type { createSyncService } from "../../services/sync-service";
import type { AppBindings } from "../../types";
import type { EventBus, SyncEvent } from "./event-bus";
import { SYNCED_TABLES } from "./get-full-state";

interface StreamDeps {
  eventBus: EventBus;
  syncService: Pick<ReturnType<typeof createSyncService>, "getFullState">;
}

/**
 * Events a slow client may leave unread before the stream replaces them with a fresh snapshot.
 * Rows are replaceable state, so a snapshot carries everything the dropped events would have.
 */
export const SYNC_STREAM_LIMITS = { events: 5_000, bytes: 8 * 1024 * 1024 };

// A snapshot carries the rows of these tables only. Other events, such as extension and resource
// notifications, exist only as events, so a snapshot cannot stand in for them.
const snapshotTables = new Set<string>(SYNCED_TABLES);

const formatSSE = (event: SyncEvent) => ({
  data: JSON.stringify({ table: event.table, data: event.data, seq: event.seq }),
  event: event.op === "set" ? ("sync:set" as const) : ("sync:delete" as const),
  id: String(event.seq),
});

type QueuedEvent = {
  seq: number;
  notice: boolean;
  bytes: number;
  message: ReturnType<typeof formatSSE>;
};

export const streamHandler = (deps: StreamDeps, limits = SYNC_STREAM_LIMITS, heartbeatMs = 8_000) => {
  return (c: Context<AppBindings>) => {
    const sinceParam = c.req.query("since");
    const since = sinceParam ? Number(sinceParam) : null;

    return streamSSE(c, async (stream) => {
      const queue: QueuedEvent[] = [];
      let queuedBytes = 0;
      let resnapshot = false;
      let live = false;
      let draining = false;
      let coveredRowsSeq = 0;
      let replayedSeq = 0;
      let deliveredSeq = since ?? 0;
      let heartbeat: ReturnType<typeof setTimeout>;
      const ending = Promise.withResolvers<void>();
      let ended = false;

      const end = (error?: unknown) => {
        if (ended) return;
        ended = true;
        cleanup();
        clearTimeout(heartbeat);
        queue.length = 0;
        queuedBytes = 0;
        stream.abort();
        ending.resolve();
        if (error !== undefined)
          apiLogger.warn({ err: error, event: "sync_stream_ended" }, "Sync stream ended so the client reconnects");
      };

      const write = async (message: Parameters<typeof stream.writeSSE>[0], seq: number) => {
        if (ended) return;
        await stream.writeSSE(message);
        deliveredSeq = Math.max(deliveredSeq, seq);
      };

      const writeSnapshot = async () => {
        const seq = deps.eventBus.seq;
        const tables = await deps.syncService.getFullState();
        if (ended) return;
        coveredRowsSeq = seq;
        // A snapshot covers rows, but reconnect must still replay any older notices we have not sent.
        const firstNotice = queue.find((event) => event.notice && event.seq > replayedSeq);
        const resumeSeq = firstNotice ? Math.min(seq, firstNotice.seq - 1) : seq;
        await write({ data: JSON.stringify({ tables, seq: resumeSeq }), event: "init" }, resumeSeq);
      };

      const hasPending = () => resnapshot || queue.length > 0;
      const needsSnapshot = () => resnapshot && (queue[0]?.seq ?? Infinity) > coveredRowsSeq;
      const writeQueued = async () => {
        while (!ended && hasPending()) {
          // Finish sending notices already covered by the last snapshot before starting another.
          if (needsSnapshot()) {
            resnapshot = false;
            await writeSnapshot();
            continue;
          }
          const event = queue.shift()!;
          queuedBytes -= event.bytes;
          const covered = event.notice ? replayedSeq : coveredRowsSeq;
          if (event.seq > covered) await write(event.message, event.seq);
        }
      };

      const drain = () => {
        if (draining || !live || ended) return;
        draining = true;
        void writeQueued().then(() => {
          draining = false;
          if (hasPending()) drain();
        }, end);
      };

      const overLimit = () => queue.length > limits.events || queuedBytes > limits.bytes;
      const enqueue = (event: SyncEvent) => {
        const notice = !snapshotTables.has(event.table);
        if (resnapshot && !notice) return;
        const message = formatSSE(event);
        const bytes = Buffer.byteLength(message.data);
        queue.push({ seq: event.seq, notice, bytes, message });
        queuedBytes += bytes;
        if (!overLimit()) return;

        const notices = queue.filter((entry) => entry.notice);
        queue.splice(0, queue.length, ...notices);
        queuedBytes = notices.reduce((total, entry) => total + entry.bytes, 0);
        resnapshot = true;
        if (overLimit()) end(new Error("Notifications a sync client has not read passed the stream's limit."));
      };

      // Subscribe before the initial snapshot or replay to retain events that arrive during either.
      const cleanup = deps.eventBus.subscribe((event) => {
        if (ended) return;
        try {
          enqueue(event);
          drain();
        } catch (error) {
          end(error);
        }
      });
      stream.onAbort(() => end());

      const writeInitialEvents = async () => {
        const minSeq = deps.eventBus.minSeq();
        if (since === null || minSeq === null || since < minSeq - 1) {
          await writeSnapshot();
          return;
        }
        const missed = deps.eventBus.getSince(since);
        replayedSeq = missed.at(-1)?.seq ?? since;
        coveredRowsSeq = replayedSeq;
        for (const event of missed) {
          if (ended) return;
          await write(formatSSE(event), event.seq);
        }
      };

      const sendHeartbeat = async () => {
        try {
          // Keep the connection alive without acknowledging a snapshot or events still in flight.
          const seq = deliveredSeq;
          await write({ data: JSON.stringify({ seq }), event: "heartbeat" }, seq);
          if (!ended) heartbeat = setTimeout(sendHeartbeat, heartbeatMs);
        } catch (error) {
          end(error);
        }
      };

      heartbeat = setTimeout(sendHeartbeat, heartbeatMs);
      void writeInitialEvents().then(() => {
        live = true;
        drain();
      }, end);
      await ending.promise;
    });
  };
};
