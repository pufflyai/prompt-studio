import { expect, test } from "bun:test";
import { createClient } from "./client";

test("Activity observation reports rejected subscriptions instead of silently completing", async () => {
  const encoder = new TextEncoder();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/v1/session-stream")
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('event: connected\ndata: {"connection_id":"connection"}\n\n'));
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (request.method === "POST") return Response.json({ error: "Discussion access denied" }, { status: 400 });
      return new Response(null, { status: 204 });
    },
  });
  const controller = new AbortController();
  try {
    const client = createClient({ baseUrl: server.url.origin, token: "" });
    await expect(
      client.activity.watch(
        { projectId: "project", extensionId: "notes", type: "note", id: "one" },
        { signal: controller.signal, onChange() {} },
      ),
    ).rejects.toThrow("Discussion access denied");
  } finally {
    controller.abort();
    await server.stop(true);
  }
});
