import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { DbClient } from "pstdio-db";
import type { AppBindings } from "../../types";
import type { EventBus, SyncEvent } from "./event-bus";
import { getFullState } from "./get-full-state";

interface StreamDeps {
  eventBus: EventBus;
  db: DbClient;
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
      if (since !== null) {
        const missed = deps.eventBus.getSince(since);
        for (const event of missed) {
          await stream.writeSSE(formatSSE(event));
        }
      } else {
        const tables = await getFullState(deps.db);
        const seq = deps.eventBus.seq;

        await stream.writeSSE({
          data: JSON.stringify({ tables, seq }),
          event: "init",
        });
      }

      // Queue events and drain serially so fire-and-forget emit() never drops writes
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

      const unsubscribe = deps.eventBus.subscribe((event) => {
        queue.push(event);
        drain();
      });

      stream.onAbort(() => {
        unsubscribe();
      });

      while (true) {
        await stream.sleep(30_000);
        const seq = deps.eventBus.seq;
        await stream.writeSSE({ data: JSON.stringify({ seq }), event: "heartbeat" });
      }
    });
  };
};
