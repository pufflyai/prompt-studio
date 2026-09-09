import { afterEach, describe, expect, it, mock } from "bun:test";
import { createClient } from "./client";
import { parseSyncDeleteEvent } from "./sync";

const waitFor = async (condition: () => boolean, timeout = 1000) => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

const createSseStream = () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
    },
  });

  return {
    response: new Response(stream, { status: 200 }),
    open: () => controller?.enqueue(encoder.encode(": connected\n\n")),
    send: (event: string, data: unknown) => {
      controller?.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    },
    close: () => controller?.close(),
  };
};

const activeConnections: Array<{ close: () => void }> = [];

afterEach(() => {
  for (const connection of activeConnections.splice(0)) {
    connection.close();
  }
});

describe("sync client", () => {
  it("announces a cursor reconnect before any replay event and only once per connection", async () => {
    const streams = [createSseStream(), createSseStream()];
    const paths: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        paths.push(new URL(request.url).pathname + new URL(request.url).search);
        streams[paths.length - 1]!.open();
        return streams[paths.length - 1]!.response;
      },
    });
    let connectedCount = 0;
    let disconnectedCount = 0;
    let snapshots = 0;
    const connection = createClient({ baseUrl: server.url.toString() }).sync.start({
      getWriter: () => ({
        truncateAndWrite: () => snapshots++,
        upsert: () => undefined,
        remove: () => undefined,
      }),
      reconnectDelayMs: 1,
      onConnected: () => connectedCount++,
      onDisconnected: () => disconnectedCount++,
    });
    try {
      await waitFor(() => paths.length === 1);
      expect(connection.connected).toBe(false);
      streams[0]!.send("init", { tables: { projects: [] }, seq: 5 });
      await waitFor(() => connectedCount === 1);
      streams[0]!.close();
      await waitFor(() => paths.length === 2);
      await waitFor(() => connectedCount === 2);
      expect(paths).toEqual(["/v1/sync/stream", "/v1/sync/stream?since=5"]);
      expect(connection.connected).toBe(true);
      expect(disconnectedCount).toBe(1);
      streams[1]!.send("heartbeat", { seq: 5 });
      streams[1]!.send("init", { tables: { projects: [] }, seq: 6 });
      await waitFor(() => snapshots === 2);
      expect(connectedCount).toBe(2);
    } finally {
      connection.close();
      server.stop(true);
    }
  });

  it("connects to the sync stream and projects init rows", async () => {
    const stream = createSseStream();
    const calls: Array<{ init: RequestInit; url: string }> = [];
    const rows: Array<{ id: string; [key: string]: unknown }> = [];
    const fetchFn = ((url: string, init: RequestInit) => {
      calls.push({ init, url: String(url) });
      return Promise.resolve(stream.response);
    }) as unknown as typeof fetch;
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn, token: "secret" });

    const connection = client.sync.start({
      getWriter: () => ({
        truncateAndWrite: (nextRows) => {
          rows.splice(0, rows.length, ...nextRows);
        },
        upsert: mock(),
        remove: mock(),
      }),
    });
    activeConnections.push(connection);

    stream.send("init", { tables: { projects: [{ id: "p1", name: "Project 1" }] }, seq: 5 });

    await waitFor(() => rows.length === 1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://test:1234/v1/sync/stream");
    expect(calls[0]?.init.credentials).toBe("same-origin");
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    expect(rows).toEqual([{ id: "p1", name: "Project 1" }]);
    expect(connection.connected).toBe(true);
  });

  it("reads sync delete ids from current and legacy payloads", () => {
    expect(parseSyncDeleteEvent(JSON.stringify({ table: "projects", id: "p1", seq: 1 }))).toEqual({
      table: "projects",
      id: "p1",
      seq: 1,
    });
    expect(parseSyncDeleteEvent(JSON.stringify({ table: "projects", data: { id: "p2" }, seq: 2 }))).toEqual({
      table: "projects",
      id: "p2",
      seq: 2,
    });
  });
});
