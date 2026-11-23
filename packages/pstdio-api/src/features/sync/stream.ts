import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { createSyncService } from "../../services/sync-service";
import type { AppBindings } from "../../types";
import type { EventBus, SyncEvent } from "./event-bus";

interface StreamDeps {
  eventBus: EventBus;
  syncService: Pick<ReturnType<typeof createSyncService>, "getFullState">;
}

/**
 * Events a slow client may leave unread before the stream replaces them with a fresh snapshot.
 * Rows are replaceable state, so a snapshot carries everything the dropped events would have.
 */
export const SYNC_STREAM_LIMITS = { events: 5_000, bytes: 8 * 1024 * 1024 };

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
      const queue: { seq: number; message: ReturnType<typeof formatSSE> }[] = [];
      let queuedBytes = 0;
      let resnapshot = false;
      let live = false;
      let draining = false;
      let snapshotSeq = 0;

      const writeSnapshot = async () => {
        // Capture seq before reading so events emitted during the read are replayed
        snapshotSeq = deps.eventBus.seq;
        const tables = await deps.syncService.getFullState();
        await stream.writeSSE({
          data: JSON.stringify({ tables, seq: snapshotSeq }),
          event: "init",
        });
      };

      const drain = async () => {
        if (draining || !live) return;
        draining = true;
        while (resnapshot || queue.length > 0) {
          if (resnapshot) {
            resnapshot = false;
            await writeSnapshot();
            continue;
          }
          const { seq, message } = queue.shift()!;
          queuedBytes -= message.data.length;
          if (seq > snapshotSeq) await stream.writeSSE(message);
        }
        draining = false;
      };

      const cleanup = deps.eventBus.subscribe((event) => {
        if (!resnapshot) {
          const message = formatSSE(event);
          queue.push({ seq: event.seq, message });
          queuedBytes += message.data.length;
          if (queue.length > limits.events || queuedBytes > limits.bytes) {
            // The client fell behind: drop what it has not read and send current state instead.
            queue.length = 0;
            queuedBytes = 0;
            resnapshot = true;
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

      await writeInitialEvents();
      live = true;
      await drain();

      while (true) {
        await stream.sleep(8_000);
        const seq = deps.eventBus.seq;
        await stream.writeSSE({ data: JSON.stringify({ seq }), event: "heartbeat" });
      }
    });
  };
};
