import { expect, test } from "bun:test";
import { createClient } from "./client";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const retentionServer = (status: number, code?: string) => {
  let posts = 0;
  let deletes = 0;
  let connections = 0;
  const fetch = (async (_url, init) => {
    if (init?.method === "POST") {
      if (!String(init.body).includes("retain_session_id")) return new Response(null, { status: 204 });
      posts++;
      return Response.json({ error: "Rejected subscription", code }, { status });
    }
    if (init?.method === "DELETE") {
      deletes++;
      return new Response(null, { status: 204 });
    }
    const id = ++connections;
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`event: connected\ndata: {"connection_id":"${id}"}\n\n`));
        },
      }),
    );
  }) as typeof globalThis.fetch;
  return { fetch, posts: () => posts, deletes: () => deletes, connections: () => connections };
};

test.each([400, 401, 403, 404, 410])("retention stops after a definitive HTTP %s rejection", async (status) => {
  const server = retentionServer(status);
  const client = createClient({ baseUrl: "http://test", fetch: server.fetch });
  const first = client.sessions.retainResources("deleted");
  const second = client.sessions.retainResources("also-deleted");
  const live = client.sessions.connectStream("working", {});
  try {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(server.posts()).toBe(2);
    expect(server.deletes()).toBe(0);
    expect(server.connections()).toBe(1);
  } finally {
    first.close();
    second.close();
    live.close();
  }
});

test.each([408, 429, 503])("retention retries a transient HTTP %s response", async (status) => {
  const server = retentionServer(status);
  const retained = createClient({ baseUrl: "http://test", fetch: server.fetch }).sessions.retainResources("saved");
  try {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(server.posts()).toBe(2);
  } finally {
    retained.close();
  }
});

test("a missing stream reconnects instead of treating the retained session as deleted", async () => {
  const server = retentionServer(404, "SESSION_STREAM_NOT_FOUND");
  const client = createClient({ baseUrl: "http://test", fetch: server.fetch });
  const retained = client.sessions.retainResources("saved");
  const live = client.sessions.connectStream("working", {});
  try {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(server.connections()).toBe(2);
    expect(server.posts()).toBe(2);
  } finally {
    retained.close();
    live.close();
  }
});

test.each([401, 404])("retention stops if opening the shared stream is rejected with HTTP %s", async (status) => {
  let attempts = 0;
  const retained = createClient({
    baseUrl: "http://test",
    fetch: (async () => {
      attempts++;
      return Response.json({ error: "Rejected connection" }, { status });
    }) as unknown as typeof fetch,
  }).sessions.retainResources("saved");
  try {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(attempts).toBe(1);
  } finally {
    retained.close();
  }
});
