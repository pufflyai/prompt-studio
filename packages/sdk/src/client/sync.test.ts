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
  it("connects to the sync stream and projects init rows", async () => {
    const stream = createSseStream();
    const calls: string[] = [];
    const rows: Array<{ id: string; [key: string]: unknown }> = [];
    const fetchFn = ((url: string) => {
      calls.push(String(url));
      return Promise.resolve(stream.response);
    }) as unknown as typeof fetch;
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

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
    expect(calls).toEqual(["http://test:1234/v1/sync/stream"]);
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
