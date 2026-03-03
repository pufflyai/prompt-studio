import { afterEach, describe, expect, mock, test } from "bun:test";
import { getCollection } from "./collections";
import { startSync } from "./sync-client";

const sseMessage = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const createSSEStream = () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  return {
    stream,
    send: (event: string, data: unknown) => controller.enqueue(encoder.encode(sseMessage(event, data))),
    close: () => controller.close(),
  };
};

let activeStream: ReturnType<typeof createSSEStream> | null = null;
const originalFetch = globalThis.fetch;

afterEach(() => {
  activeStream?.close();
  activeStream = null;
  globalThis.fetch = originalFetch;
});

const mockFetch = () => {
  activeStream = createSSEStream();
  const stream = activeStream;
  const fetchMock = mock(() =>
    Promise.resolve(new Response(stream.stream, { headers: { "content-type": "text/event-stream" } })),
  );
  const typedFetchMock = Object.assign(fetchMock, {
    preconnect: originalFetch.preconnect,
  }) as typeof fetch;

  globalThis.fetch = typedFetchMock;
  return stream;
};

describe("startSync", () => {
  test("connects to the SSE stream", async () => {
    mockFetch();
    const client = startSync("http://localhost:3000");

    expect(globalThis.fetch).toHaveBeenCalledWith("http://localhost:3000/v1/sync/stream", expect.any(Object));

    client.close();
  });

  test("populates collections on init event", async () => {
    const stream = mockFetch();
    const client = startSync("http://localhost:3000");

    stream.send("init", {
      tables: {
        projects: [
          { id: "p1", name: "Project 1" },
          { id: "p2", name: "Project 2" },
        ],
        agent_configs: [{ id: "a1", agent_id: "claude" }],
      },
      seq: 5,
    });

    // Let the stream reader process
    await new Promise((r) => setTimeout(r, 10));

    const projectsCol = getCollection("projects");
    expect(projectsCol.state.size).toBe(2);
    expect(projectsCol.get("p1")?.name).toBe("Project 1");

    const agentsCol = getCollection("agent_configs");
    expect(agentsCol.state.size).toBe(1);

    expect(client.connected).toBe(true);
    client.close();
  });

  test("handles sync:set events for new items", async () => {
    const stream = mockFetch();
    const client = startSync("http://localhost:3000");

    stream.send("init", { tables: { projects: [] }, seq: 0 });
    stream.send("sync:set", { table: "projects", data: { id: "p1", name: "New Project" }, seq: 1 });

    await new Promise((r) => setTimeout(r, 10));

    const col = getCollection("projects");
    expect(col.state.size).toBe(1);
    expect(col.get("p1")?.name).toBe("New Project");
    client.close();
  });

  test("handles sync:delete events", async () => {
    const stream = mockFetch();
    const client = startSync("http://localhost:3000");

    stream.send("init", { tables: { projects: [{ id: "p1", name: "To Delete" }] }, seq: 0 });
    stream.send("sync:delete", { table: "projects", id: "p1", seq: 1 });

    await new Promise((r) => setTimeout(r, 10));

    const col = getCollection("projects");
    expect(col.state.size).toBe(0);
    client.close();
  });

  test("disconnects on close()", () => {
    mockFetch();
    const client = startSync("http://localhost:3000");

    client.close();

    expect(client.connected).toBe(false);
  });
});
