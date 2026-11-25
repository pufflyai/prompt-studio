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
  test("does not drop updates while a slow reader drains the initial events", async () => {
    const eventBus = new EventBus();
    const syncService = {
      getFullState: async () => {
        for (const status of ["queued", "in_progress", "completed"])
          eventBus.emit("sessions", "set", { id: "s1", status });
        return { sessions: [] };
      },
    } as Parameters<typeof streamHandler>[0]["syncService"];
    const app = new Hono();
    app.get("/stream", streamHandler({ eventBus, syncService }));
    const sse = createSSEReader(await app.request("/stream"));
    try {
      const initial = await sse.readEvents(2);
      expect(initial.map((event) => event.event)).toEqual(["init", "sync:set"]);
      eventBus.emit("sessions", "set", { id: "s1", status: "archived" });
      const updates = await sse.readEvents(3);
      expect(updates.map((event) => event.data)).toEqual([
        { table: "sessions", data: { id: "s1", status: "in_progress" }, seq: 2 },
        { table: "sessions", data: { id: "s1", status: "completed" }, seq: 3 },
        { table: "sessions", data: { id: "s1", status: "archived" }, seq: 4 },
      ]);
    } finally {
      await sse.close();
    }
  });

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

  test("a client that falls behind gets a fresh snapshot instead of an unbounded queue", async () => {
    const eventBus = new EventBus();
    const rows = new Map<string, unknown>();
    const syncService = {
      getFullState: async () => ({ sessions: [...rows.values()] }),
    } as Parameters<typeof streamHandler>[0]["syncService"];
    const app = new Hono();
    app.get("/stream", streamHandler({ eventBus, syncService }, { events: 3, bytes: 1024 * 1024 }));
    const sse = createSSEReader(await app.request("/stream"));
    try {
      expect((await sse.readEvents(1)).map((event) => event.event)).toEqual(["init"]);
      // Emitted in one turn, so the unread queue passes its limit before the stream writes any of them.
      for (let index = 0; index < 10; index++) {
        rows.set("s1", { id: "s1", status: `step-${index}` });
        eventBus.emit("sessions", "set", { id: "s1", status: `step-${index}` });
      }
      // Depending on whether the stream was still bootstrapping, the first update may precede the resync.
      let resync: SSEEvent | undefined;
      for (let read = 0; !resync && read < 3; read++)
        resync = (await sse.readEvents(1)).find((event) => event.event === "init");
      expect(resync?.data).toEqual({ tables: { sessions: [{ id: "s1", status: "step-9" }] }, seq: 10 });
      eventBus.emit("sessions", "set", { id: "s1", status: "after" });
      const [after] = await sse.readEvents(1);
      expect(after?.data).toEqual({ table: "sessions", data: { id: "s1", status: "after" }, seq: 11 });
    } finally {
      await sse.close();
    }
  });

  test("a client that falls behind still gets the notifications a fresh snapshot does not carry", async () => {
    const eventBus = new EventBus();
    const syncService = {
      getFullState: async () => ({ sessions: [] }),
    } as Parameters<typeof streamHandler>[0]["syncService"];
    const app = new Hono();
    app.get("/stream", streamHandler({ eventBus, syncService }, { events: 3, bytes: 1024 * 1024 }));
    const sse = createSSEReader(await app.request("/stream"));
    try {
      expect((await sse.readEvents(1)).map((event) => event.event)).toEqual(["init"]);
      // Emitted in one turn: the first notice is queued before the limit is passed, the second after.
      for (let index = 0; index < 10; index++) {
        if (index === 3) eventBus.emit("extension_events", "set", { id: "storage-changed" });
        eventBus.emit("sessions", "set", { id: "s1", status: `step-${index}` });
      }
      eventBus.emit("resource_events", "set", { id: "resource-changed" });
      const events: SSEEvent[] = [];
      const afterResync = () => events.slice(events.map((event) => event.event).lastIndexOf("init") + 1);
      const read = async () => {
        while (afterResync().length < 2) {
          const next = await sse.readEvents(1);
          if (next.length === 0) return;
          events.push(...next);
        }
      };
      await Promise.race([read(), Bun.sleep(2_000)]);
      expect(events.some((event) => event.event === "init")).toBe(true);
      expect(afterResync().map((event) => (event.data as { data: { id: string } }).data.id)).toEqual([
        "storage-changed",
        "resource-changed",
      ]);
    } finally {
      await sse.close();
    }
  });

  test("a replacement snapshot that fails ends the stream so the client reconnects", async () => {
    const eventBus = new EventBus();
    let snapshots = 0;
    const syncService = {
      getFullState: async () => {
        if (++snapshots > 1) throw new Error("database unavailable");
        return { sessions: [] };
      },
    } as Parameters<typeof streamHandler>[0]["syncService"];
    const app = new Hono();
    app.get("/stream", streamHandler({ eventBus, syncService }, { events: 1, bytes: 1024 * 1024 }));
    const sse = createSSEReader(await app.request("/stream"));
    try {
      expect((await sse.readEvents(1)).map((event) => event.event)).toEqual(["init"]);
      // An update the client receives shows the stream is live; the pause lets the bootstrap drain return,
      // so the failing snapshot below runs in a drain started by a later event.
      eventBus.emit("sessions", "set", { id: "s1", status: "live" });
      expect((await sse.readEvents(1)).map((event) => event.event)).toEqual(["sync:set"]);
      await Bun.sleep(20);
      for (let index = 0; index < 5; index++) eventBus.emit("sessions", "set", { id: "s1", status: `step-${index}` });
      const outcome = await Promise.race([
        sse.readEvents(Number.POSITIVE_INFINITY).then(() => "ended"),
        Bun.sleep(2_000).then(() => "still open"),
      ]);
      expect(outcome).toBe("ended");
      expect(snapshots).toBe(2);
    } finally {
      await sse.close();
    }
  });
});

describe("stream queue limits", () => {
  test("the queue counts multibyte payloads in UTF-8 bytes", async () => {
    const eventBus = new EventBus();
    const row = { id: "漢".repeat(30) };
    let snapshots = 0;
    const syncService = {
      getFullState: async () => ({ sessions: ++snapshots === 1 ? [] : [row] }),
    };
    const app = new Hono().get("/stream", streamHandler({ eventBus, syncService }, { events: 10, bytes: 96 }));
    const sse = createSSEReader(await app.request("/stream"));
    try {
      await sse.readEvents(1);
      eventBus.emit("sessions", "set", row);
      expect(await sse.readEvents(1)).toEqual([{ event: "init", data: { tables: { sessions: [row] }, seq: 1 } }]);
    } finally {
      await sse.close();
    }
  });

  test("notification overflow closes a stream while its initial snapshot is pending", async () => {
    const snapshot = Promise.withResolvers<Record<string, unknown[]>>();
    let subscriptions = 0;
    const eventBus = new (class extends EventBus {
      override subscribe(cb: Parameters<EventBus["subscribe"]>[0]) {
        subscriptions++;
        const unsubscribe = super.subscribe(cb);
        return () => {
          subscriptions--;
          unsubscribe();
        };
      }
    })();
    const syncService = { getFullState: () => snapshot.promise };
    const app = new Hono().get("/stream", streamHandler({ eventBus, syncService }, { events: 1, bytes: 4096 }));
    const response = await app.request("/stream");
    try {
      expect(subscriptions).toBe(1);
      eventBus.emit("extension_events", "set", { id: "first" });
      eventBus.emit("extension_events", "set", { id: "second" });
      expect(subscriptions).toBe(0);
      expect(await response.text()).toBe("");
    } finally {
      snapshot.resolve({ sessions: [] });
      if (!response.bodyUsed) await response.body?.cancel();
    }
  });
});
