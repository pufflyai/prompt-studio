import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { createSyncService } from "../../services/sync-service";
import type { AppBindings } from "../../types";
import type { EventBus, SyncEvent } from "./event-bus";

interface StreamDeps {
  eventBus: EventBus;
  syncService: ReturnType<typeof createSyncService>;
}

const formatSSE = (event: SyncEvent) => ({
  data: JSON.stringify({ table: event.table, data: event.data, seq: event.seq }),
  event: event.op === "set" ? ("sync:set" as const) : ("sync:delete" as const),
  id: String(event.seq),
});

export const streamHandler = (deps: StreamDeps) => {
  return (c: Context<AppBindings>) => {
    const sinceParam = c.req.query("since");
    const since = sinceParam ? Number(sinceParam) : null;

    return streamSSE(c, async (stream) => {
      // Subscribe BEFORE snapshot to buffer any events emitted during bootstrap.
      // This closes the race window where events could be lost between
      // reading state and subscribing.
      const buffer: SyncEvent[] = [];
      let cleanup = deps.eventBus.subscribe((event) => {
        buffer.push(event);
      });

      stream.onAbort(() => {
        cleanup();
      });

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

      // Drain buffered events that arrived after the snapshot boundary
      const pendingEvents = buffer.filter((e) => e.seq > snapshotSeq);
      for (const event of pendingEvents) {
        await stream.writeSSE(formatSSE(event));
      }

      // Switch to live drain mode
      const queue: SyncEvent[] = [];
      let draining = false;

      const drain = async () => {
        if (draining) return;
        draining = true;
        while (queue.length > 0) {
          const event = queue.shift()!;
          await stream.writeSSE(formatSSE(event));
        }
        draining = false;
      };

      // Replace buffer subscriber with live queue subscriber
      cleanup();
      cleanup = deps.eventBus.subscribe((event) => {
        queue.push(event);
        drain();
      });

      while (true) {
        await stream.sleep(8_000);
        const seq = deps.eventBus.seq;
        await stream.writeSSE({ data: JSON.stringify({ seq }), event: "heartbeat" });
      }
    });
  };
};
