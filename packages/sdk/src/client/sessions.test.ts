import { describe, expect, it } from "bun:test";
import { createClient } from "./client";

type FakeCall = {
  method: string;
  url: string;
  auth: string | null;
  body?: Record<string, string>;
  signal?: AbortSignal | null;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const createFakeStreamServer = ({ holdSubscribes = false } = {}) => {
  const calls: FakeCall[] = [];
  const heldSubscribes: Array<() => void> = [];
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  const fetchFn = ((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({
      method,
      url: String(url),
      auth: new Headers(init?.headers).get("authorization"),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      signal: init?.signal,
    });
    if (method === "POST" && holdSubscribes) {
      return new Promise((resolve) => heldSubscribes.push(() => resolve(new Response(null, { status: 204 }))));
    }
    if (method !== "GET") return Promise.resolve(new Response(null, { status: 204 }));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        stream = controller;
      },
    });
    return Promise.resolve(new Response(body, { status: 200 }));
  }) as unknown as typeof fetch;
  return {
    fetchFn,
    calls: (method: string) => calls.filter((call) => call.method === method),
    send: (event: string, data: unknown) =>
      stream!.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)),
    end: () => stream!.close(),
    finishSubscribes: () => {
      for (const finish of heldSubscribes.splice(0)) finish();
    },
  };
};

describe("session stream client", () => {
  it("uploads and deletes session attachments through the sdk client", async () => {
    const calls: Array<{ url: string; method: string; headers: Headers; body?: BodyInit | null }> = [];
    const fetchFn = ((url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: init?.body,
      });

      if (calls.length === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              file_id: "file-1",
              name: "notes.txt",
              mime_type: "text/plain",
              size_bytes: 5,
              hash: null,
              url: "/content",
              created_at: "2026-06-17T10:00:00.000Z",
              updated_at: "2026-06-17T10:00:00.000Z",
            }),
            { status: 201 },
          ),
        );
      }

      return Promise.resolve(new Response(null, { status: 204 }));
    }) as unknown as typeof fetch;
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    const uploaded = await client.sessions.uploadAttachment("project 1", {
      name: "notes.txt",
      data: new TextEncoder().encode("hello"),
      mimeType: "text/plain",
    });
    await client.sessions.deleteAttachment("project 1", uploaded.file_id);

    expect(calls[0]).toMatchObject({
      url: "http://test:1234/v1/projects/project%201/session-attachments",
      method: "POST",
    });
    expect(calls[0]!.headers.get("content-type")).toBe("text/plain");
    expect(calls[0]!.headers.get("x-file-name")).toBe("notes.txt");
    expect(calls[0]!.body).toBeInstanceOf(Uint8Array);
    expect(calls[1]).toMatchObject({
      url: "http://test:1234/v1/projects/project%201/session-attachments/file-1",
      method: "DELETE",
    });
  });

  it("carries every session on one authenticated connection", async () => {
    const server = createFakeStreamServer();
    const client = createClient({ baseUrl: "http://test:1234", fetch: server.fetchFn, token: "secret" });
    const patches: Array<[string, unknown]> = [];
    const first = client.sessions.connectStream("s_1", { onPatch: (data) => patches.push(["s_1", data]) });
    const second = client.sessions.connectStream("s_2", { onPatch: (data) => patches.push(["s_2", data]) });
    await tick();
    server.send("connected", { connection_id: "c1" });
    await tick();

    expect(server.calls("GET").map((call) => [call.url, call.auth])).toEqual([
      ["http://test:1234/v1/session-stream", "Bearer secret"],
    ]);
    const subscriptions = server.calls("POST");
    expect(subscriptions.map((call) => [call.url, call.body?.session_id])).toEqual([
      ["http://test:1234/v1/session-stream/c1/subscriptions", "s_1"],
      ["http://test:1234/v1/session-stream/c1/subscriptions", "s_2"],
    ]);
    const [firstId, secondId] = subscriptions.map((call) => call.body?.subscription_id);
    server.send("patch", { subscription_id: secondId, data: { op: "add", path: "/messages/0" } });
    await tick();
    expect(patches).toEqual([["s_2", { op: "add", path: "/messages/0" }]]);

    first.close();
    await tick();
    expect(server.calls("DELETE").map((call) => call.url)).toEqual([
      `http://test:1234/v1/session-stream/c1/subscriptions/${firstId}`,
    ]);
    expect(server.calls("GET")[0]!.signal?.aborted).toBe(false);
    second.close();
    await tick();
    expect(server.calls("GET")[0]!.signal?.aborted).toBe(true);
  });

  it("stops a session only after the server has started it", async () => {
    const server = createFakeStreamServer({ holdSubscribes: true });
    const client = createClient({ baseUrl: "http://test:1234", fetch: server.fetchFn });
    const first = client.sessions.connectStream("s_1", {});
    client.sessions.connectStream("s_2", {});
    await tick();
    server.send("connected", { connection_id: "c1" });
    await tick();
    const firstId = server.calls("POST")[0]!.body?.subscription_id;

    first.close();
    await tick();
    expect(server.calls("DELETE")).toEqual([]);

    server.finishSubscribes();
    await tick();
    expect(server.calls("DELETE").map((call) => call.url)).toEqual([
      `http://test:1234/v1/session-stream/c1/subscriptions/${firstId}`,
    ]);
  });

  it("reports a dropped connection to every open session", async () => {
    const server = createFakeStreamServer();
    const client = createClient({ baseUrl: "http://test:1234", fetch: server.fetchFn });
    const errors: string[] = [];
    client.sessions.connectStream("s_1", { onError: () => errors.push("s_1") });
    client.sessions.connectStream("s_2", { onError: () => errors.push("s_2") });
    await tick();
    server.send("connected", { connection_id: "c1" });
    await tick();
    server.end();
    await tick();
    expect(errors).toEqual(["s_1", "s_2"]);
  });

  it("streams one session until it ends", async () => {
    const server = createFakeStreamServer();
    const client = createClient({ baseUrl: "http://test:1234", fetch: server.fetchFn });
    const events: { event: string; data: string }[] = [];
    const done = client.sessions.stream("s_1", (event) => events.push(event));
    await tick();
    server.send("connected", { connection_id: "c1" });
    await tick();
    const subscriptionId = server.calls("POST")[0]!.body?.subscription_id;
    server.send("ready", { subscription_id: subscriptionId, data: { sessionId: "s_1" } });
    server.send("end", { subscription_id: subscriptionId, data: { status: "completed" } });
    await done;
    await tick();

    expect(events).toEqual([
      { event: "ready", data: '{"sessionId":"s_1"}' },
      { event: "end", data: '{"status":"completed"}' },
    ]);
    expect(server.calls("GET")[0]!.signal?.aborted).toBe(true);
  });
});

it("command streams and sessions share one connection and release independently", async () => {
  const server = createFakeStreamServer();
  const client = createClient({ baseUrl: "http://test:1234", fetch: server.fetchFn });
  const session = client.sessions.connectStream("session", {});
  const stream = client.extensions.stream("logs", { projectId: "p1" });
  const collecting = Array.fromAsync(stream);
  await tick();
  server.send("connected", { connection_id: "c1" });
  await tick();
  const command = server.calls("POST").find((call) => call.body?.command)!;
  expect(server.calls("GET")).toHaveLength(1);
  server.send("chunk", { subscription_id: command.body!.subscription_id, data: "one" });
  server.send("chunk", { subscription_id: command.body!.subscription_id, data: "two" });
  const response = {
    commandId: "logs",
    extensionId: "logs",
    outcome: { ok: true, status: "success" as const, value: 2 },
  };
  server.send("end", { subscription_id: command.body!.subscription_id, data: response });
  expect(await collecting).toEqual([
    { type: "data", data: "one" },
    { type: "data", data: "two" },
    { type: "end", response },
  ]);
  expect(server.calls("GET")[0]!.signal!.aborted).toBe(false);
  session.close();
  expect(server.calls("GET")[0]!.signal!.aborted).toBe(true);
});

it("aborting a command stream releases its subscription and wakes its reader", async () => {
  const server = createFakeStreamServer();
  const client = createClient({ baseUrl: "http://test:1234", fetch: server.fetchFn });
  const controller = new AbortController();
  const stream = client.extensions.stream("logs", { projectId: "p1" }, { signal: controller.signal });
  const pending = stream[Symbol.asyncIterator]().next();
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: "command_stream_cancelled" });
  expect(server.calls("GET")[0]!.signal!.aborted).toBe(true);
});

it("keeps the server's command rejection code", async () => {
  const server = createFakeStreamServer();
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === "POST")
      return Response.json({ error: "Not streamable", code: "command_not_streamable" }, { status: 409 });
    return server.fetchFn(url, init);
  }) as typeof fetch;
  const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });
  const pending = client.extensions.stream("plain", { projectId: "p1" })[Symbol.asyncIterator]().next();
  await tick();
  server.send("connected", { connection_id: "c1" });
  await expect(pending).rejects.toMatchObject({ code: "command_not_streamable" });
});
