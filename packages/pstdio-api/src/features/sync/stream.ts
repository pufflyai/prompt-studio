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

export const streamHandler = (deps: StreamDeps, limits = SYNC_STREAM_LIMITS) => {
  return (c: Context<AppBindings>) => {
    const sinceParam = c.req.query("since");
    const since = sinceParam ? Number(sinceParam) : null;

    return streamSSE(c, async (stream) => {
      // Subscribe BEFORE the snapshot so events emitted during bootstrap are queued, not lost.
      // The same bounded queue then serves the live stream.
      // `kept` marks notifications a replacement snapshot skipped over; they are sent after it.
      const queue: { seq: number; table: string; kept: boolean; message: ReturnType<typeof formatSSE> }[] = [];
      let queuedBytes = 0;
      let resnapshot = false;
      let live = false;
      let draining = false;
      let snapshotSeq = 0;
      // Ending the stream makes the client reconnect and start over from current state.
      const ending = Promise.withResolvers<void>();
      let ended = false;
      const end = (error: unknown) => {
        if (ended) return;
        ended = true;
        queue.length = 0;
        queuedBytes = 0;
        apiLogger.warn({ err: error, event: "sync_stream_ended" }, "Sync stream ended so the client reconnects");
        ending.resolve();
      };

      const writeSnapshot = async () => {
        // Capture seq before reading so events emitted during the read are replayed
        snapshotSeq = deps.eventBus.seq;
        const tables = await deps.syncService.getFullState();
        await stream.writeSSE({
          data: JSON.stringify({ tables, seq: snapshotSeq }),
          event: "init",
        });
      };

      const writeQueued = async () => {
        while (resnapshot || queue.length > 0) {
          if (resnapshot) {
            resnapshot = false;
            await writeSnapshot();
            continue;
          }
          const { seq, kept, message } = queue.shift()!;
          queuedBytes -= message.data.length;
          if (kept || seq > snapshotSeq) await stream.writeSSE(message);
        }
      };

      const drain = async () => {
        if (draining || !live || ended) return;
        draining = true;
        try {
          await writeQueued();
          draining = false;
        } catch (error) {
          end(error);
        }
      };

      const overLimit = () => queue.length > limits.events || queuedBytes > limits.bytes;
      const cleanup = deps.eventBus.subscribe((event) => {
        if (ended) return;
        const notice = !snapshotTables.has(event.table);
        // A pending replacement snapshot carries every row, but no notifications.
        if (!resnapshot || notice) {
          const message = formatSSE(event);
          queue.push({ seq: event.seq, table: event.table, kept: resnapshot, message });
          queuedBytes += message.data.length;
          if (overLimit()) {
            // The client fell behind: drop the rows it has not read and send current state instead.
            const notices = queue.filter((entry) => !snapshotTables.has(entry.table));
            queue.splice(0, queue.length, ...notices.map((entry) => ({ ...entry, kept: true })));
            queuedBytes = notices.reduce((total, entry) => total + entry.message.data.length, 0);
            resnapshot = true;
            if (overLimit()) end(new Error("Notifications a sync client has not read passed the stream's limit."));
          }
        }
        void drain();
      });

      stream.onAbort(() => {
        cleanup();
      });

      const writeMissedEvents = async (sinceSeq: number) => {
        const missed = deps.eventBus.getSince(sinceSeq);
        snapshotSeq = missed.length > 0 ? missed[missed.length - 1].seq : sinceSeq;
        for (const event of missed) {
          await stream.writeSSE(formatSSE(event));
        }
      };

      const writeInitialEvents = async () => {
        if (since === null) {
          await writeSnapshot();
          return;
        }

        const minSeq = deps.eventBus.minSeq();
        const gapDetected = minSeq === null || since < minSeq;

        if (gapDetected) {
          await writeSnapshot();
          return;
        }

        await writeMissedEvents(since);
      };

      try {
        await writeInitialEvents();
        live = true;
        await drain();

        while (!ended) {
          await Promise.race([stream.sleep(8_000), ending.promise]);
          if (ended) break;
          const seq = deps.eventBus.seq;
          await stream.writeSSE({ data: JSON.stringify({ seq }), event: "heartbeat" });
        }
      } finally {
        cleanup();
      }
    });
  };
};
