import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { EventBus } from "./event-bus";
import { streamHandler } from "./stream";

interface SSEEvent {
  event: string;
  data: unknown;
}

const parseSSEBlock = (block: string): SSEEvent | null => {
  if (!block.trim()) return null;

  let event = "message";
  let data = "";

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data = line.slice(5).trim();
  }

  return data ? { event, data: JSON.parse(data) } : null;
};

const createSSEReader = (response: Response) => {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const readEvents = async (count: number) => {
    const events: SSEEvent[] = [];

    while (events.length < count) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed = parseSSEBlock(block);
        if (parsed) events.push(parsed);
      }
    }

    return events;
  };

  const close = () => reader.cancel();

  return { readEvents, close };
};

describe("stream bootstrap race condition", () => {
  test("does not drop events emitted during initial snapshot", async () => {
    const eventBus = new EventBus();

    const syncService = {
      getFullState: async () => {
        // Simulate a DB write happening while getFullState is running:
        // a session completes during the snapshot read
        eventBus.emit("sessions", "set", { id: "s1", status: "completed" });
        // Return stale snapshot (session still in_progress)
        return { sessions: [{ id: "s1", status: "in_progress" }] };
      },
      emitCascadeDeletes: async () => {},
    } as Parameters<typeof streamHandler>[0]["syncService"];

    const app = new Hono();
    app.get("/stream", streamHandler({ eventBus, syncService }));

    const res = await app.request("/stream");
    const sse = createSSEReader(res);

    // We expect init + a sync:set for the event emitted during snapshot
    const events = await sse.readEvents(2);
    sse.close();

    expect(events[0].event).toBe("init");

    const initData = events[0].data as { tables: Record<string, unknown[]> };
    expect(initData.tables.sessions).toEqual([{ id: "s1", status: "in_progress" }]);

    // The sync:set event must not be dropped — this is the regression
    expect(events).toHaveLength(2);
    expect(events[1].event).toBe("sync:set");

    const setData = events[1].data as { table: string; data: { id: string; status: string } };
    expect(setData.table).toBe("sessions");
    expect(setData.data.status).toBe("completed");
  });

  test("does not drop events emitted during reconnect replay", async () => {
    const eventBus = new EventBus();

    // Pre-seed the event bus with an event the client already has
    eventBus.emit("sessions", "set", { id: "s1", status: "in_progress" });
    const clientLastSeq = eventBus.seq; // 1

    // Patch getSince to emit an event mid-replay (simulates concurrent DB write)
    const originalGetSince = eventBus.getSince.bind(eventBus);
    eventBus.getSince = (seq: number) => {
      const missed = originalGetSince(seq);
      // Event emitted after getSince reads but before subscribe
      eventBus.emit("sessions", "set", { id: "s1", status: "completed" });
      // Restore original
      eventBus.getSince = originalGetSince;
      return missed;
    };

    const syncService = {
      getFullState: async () => ({}),
      emitCascadeDeletes: async () => {},
    } as Parameters<typeof streamHandler>[0]["syncService"];

    const app = new Hono();
    app.get("/stream", streamHandler({ eventBus, syncService }));

    const res = await app.request(`/stream?since=${clientLastSeq}`);
    const sse = createSSEReader(res);

    // The event emitted during getSince (seq=2) must be delivered
    const events = await sse.readEvents(1);
    sse.close();

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("sync:set");

    const setData = events[0].data as { table: string; data: { id: string; status: string } };
    expect(setData.table).toBe("sessions");
    expect(setData.data.status).toBe("completed");
  });

  test("falls back to init when reconnect since value was evicted from buffer", async () => {
    const eventBus = new EventBus({ bufferSize: 5 });

    const syncService = {
      getFullState: async () => ({
        projects: [{ id: "p1", name: "stale-reconnect-project" }],
      }),
      emitCascadeDeletes: async () => {},
    } as Parameters<typeof streamHandler>[0]["syncService"];

    const app = new Hono();
    app.get("/stream", streamHandler({ eventBus, syncService }));

    const firstConnection = await app.request("/stream");
    const firstSse = createSSEReader(firstConnection);
    const [init] = await firstSse.readEvents(1);
    firstSse.close();

    const firstSeq = (init.data as { seq: number }).seq;

    for (let index = 0; index < 10; index += 1) {
      eventBus.emit("sessions", "set", { id: `session-${index}` });
    }

    const reconnect = await app.request(`/stream?since=${firstSeq}`);
    const reconnectSse = createSSEReader(reconnect);
    const [firstReconnectEvent] = await reconnectSse.readEvents(1);
    reconnectSse.close();

    expect(firstReconnectEvent.event).toBe("init");
  });
});
