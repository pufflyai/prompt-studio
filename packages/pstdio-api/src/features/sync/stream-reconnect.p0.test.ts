import { expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import { Hono } from "hono";
import { EventBus } from "./event-bus";
import { streamHandler } from "./stream";

const connect = (
  app: Hono,
  inspectFrame: (chunk: Uint8Array, controller: TransformStreamDefaultController<Uint8Array>) => void,
) => {
  const reconnected = Promise.withResolvers<string>();
  const client = createClient({
    baseUrl: "http://sync.test",
    fetch: (async (input, init) => {
      const url = new URL(String(input));
      const response = await app.request(url, init);
      if (url.search) {
        reconnected.resolve(url.search);
        return response;
      }
      return new Response(response.body!.pipeThrough(new TransformStream({ transform: inspectFrame })));
    }) as typeof fetch,
  });
  return { client, reconnected: reconnected.promise };
};

test("reconnect replays a notice interrupted immediately after a replacement snapshot", async () => {
  // The first row can leave the replay ring while the next required notice is still present.
  const eventBus = new EventBus({ bufferSize: 3 });
  const syncService = { getFullState: async () => ({ sessions: [] }) };
  const app = new Hono().get("/v1/sync/stream", streamHandler({ eventBus, syncService }, { events: 2, bytes: 4096 }));
  const initial = Promise.withResolvers<void>();
  const notice = Promise.withResolvers<string>();
  const decoder = new TextDecoder();
  let snapshots = 0;
  const { client, reconnected } = connect(app, (chunk, controller) => {
    controller.enqueue(chunk);
    if (decoder.decode(chunk).startsWith("event: init") && ++snapshots === 2) controller.terminate();
  });
  const connection = client.sync.start({
    getWriter: (table) =>
      table === "resource_events"
        ? { truncateAndWrite() {}, upsert: (row) => notice.resolve(row.id), remove() {} }
        : undefined,
    onConnected: () => initial.resolve(),
    reconnectDelayMs: 1,
  });
  try {
    await initial.promise;
    eventBus.emit("sessions", "set", { id: "first" });
    eventBus.emit("resource_events", "set", { id: "resource-removed" });
    eventBus.emit("sessions", "set", { id: "second" });
    eventBus.emit("sessions", "set", { id: "third" });
    expect(await reconnected).toBe("?since=1");
    expect(await notice.promise).toBe("resource-removed");
  } finally {
    connection.close();
  }
});

test("a heartbeat during a failed replacement snapshot does not skip rows on reconnect", async () => {
  const eventBus = new EventBus();
  const pending = Promise.withResolvers<Record<string, unknown[]>>();
  let snapshots = 0;
  const syncService = {
    getFullState: () => (++snapshots === 1 ? Promise.resolve({ sessions: [] }) : pending.promise),
  };
  const app = new Hono().get(
    "/v1/sync/stream",
    streamHandler({ eventBus, syncService }, { events: 1, bytes: 4096 }, 50),
  );
  const initial = Promise.withResolvers<void>();
  const beforeOverflow = Promise.withResolvers<void>();
  const recovered = Promise.withResolvers<void>();
  const decoder = new TextDecoder();
  const { client, reconnected } = connect(app, (chunk, controller) => {
    controller.enqueue(chunk);
    if (snapshots === 2 && decoder.decode(chunk).startsWith("event: heartbeat"))
      pending.reject(new Error("replacement snapshot failed"));
  });
  const connection = client.sync.start({
    getWriter: (table) =>
      table === "sessions"
        ? {
            truncateAndWrite() {},
            upsert: (row) => {
              if (row.id === "initial") beforeOverflow.resolve();
              if (row.id === "recovered") recovered.resolve();
            },
            remove() {},
          }
        : undefined,
    onConnected: () => initial.resolve(),
    reconnectDelayMs: 1,
  });
  try {
    await initial.promise;
    eventBus.emit("sessions", "set", { id: "initial" });
    await beforeOverflow.promise;
    // Allow the initial drain to hand off to the live loop before starting the replacement.
    await Bun.sleep(0);
    eventBus.emit("sessions", "set", { id: "first" });
    eventBus.emit("sessions", "set", { id: "second" });
    eventBus.emit("sessions", "set", { id: "recovered" });
    expect(["?since=1", "?since=2"]).toContain(await reconnected);
    await recovered.promise;
  } finally {
    connection.close();
    pending.resolve({ sessions: [] });
  }
});
