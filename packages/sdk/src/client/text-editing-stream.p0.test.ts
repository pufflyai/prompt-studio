import { expect, test } from "bun:test";
import { createClient } from "./client";

test("five text watches share one client stream and cancelling one keeps the other watches", async () => {
  const opened: string[] = [];
  const started = Promise.withResolvers<void>();
  let logical = 0;
  const controllers: AbortController[] = [];
  const watches: Promise<void>[] = [];
  const connections: Awaited<ReturnType<ReturnType<typeof createClient>["textEditing"]["connect"]>>[] = [];
  const subscriptionIds = new Set<string>();
  const scopedProjects: unknown[] = [];
  const removed = Promise.withResolvers<void>();
  let shared: ReadableStreamDefaultController<Uint8Array> | undefined;
  const delivered = Promise.withResolvers<void>();
  const received = Array<number>(5).fill(0);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/text-editing")) return Response.json({ ok: true, value: { token: crypto.randomUUID() } });
      if (path === "/v1/session-stream" || path.endsWith("/text-editing/stream")) {
        opened.push(path);
        if (path.endsWith("/text-editing/stream") && ++logical === 5) started.resolve();
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            if (path === "/v1/session-stream") shared = controller;
            const event =
              path === "/v1/session-stream"
                ? 'event: connected\ndata: {"connection_id":"shared"}\n\n'
                : "event: ready\ndata: {}\n\n";
            controller.enqueue(new TextEncoder().encode(event));
            request.signal.addEventListener(
              "abort",
              () => {
                try {
                  controller.close();
                } catch {}
              },
              { once: true },
            );
          },
        });
        return new Response(body, { headers: { "content-type": "text/event-stream" } });
      }
      if (path === "/v1/session-stream/shared/subscriptions") {
        const input = await request.json();
        subscriptionIds.add(input.subscription_id);
        scopedProjects.push(input.text_editing?.project_id);
        if (++logical === 5) started.resolve();
        return new Response(null, { status: 204 });
      }
      if (request.method === "DELETE" && path.startsWith("/v1/session-stream/shared/subscriptions/")) {
        subscriptionIds.delete(path.split("/").at(-1)!);
        removed.resolve();
        return new Response(null, { status: 204 });
      }
      return Response.json({ ok: true, value: null });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin });
    for (let index = 0; index < 5; index++) {
      const connection = await client.textEditing.connect({
        projectId: "project",
        scope: { kind: "placement", viewId: `example.editor-${index}` },
      });
      connections.push(connection);
      const controller = new AbortController();
      controllers.push(controller);
      watches.push(
        connection.watch({
          signal: controller.signal,
          onEvent(event) {
            if (event.type === "prepareClose") {
              received[index]!++;
              if (received.slice(1).every((count) => count === 1)) delivered.resolve();
            }
          },
        }),
      );
    }
    await started.promise;
    expect(opened).toEqual(["/v1/session-stream"]);
    expect(scopedProjects).toEqual(Array(5).fill("project"));
    controllers[0]!.abort();
    await watches[0];
    expect(controllers.slice(1).every((controller) => !controller.signal.aborted)).toBe(true);
    expect(opened).toHaveLength(1);
    await removed.promise;
    expect(subscriptionIds.size).toBe(4);
    for (const subscription_id of subscriptionIds)
      shared!.enqueue(
        new TextEncoder().encode(
          `event: text\ndata: ${JSON.stringify({ subscription_id, data: { type: "prepareClose", barrierId: "barrier" } })}\n\n`,
        ),
      );
    await delivered.promise;
    expect(received).toEqual([0, 1, 1, 1, 1]);
  } finally {
    for (const controller of controllers) controller.abort();
    await Promise.allSettled(watches);
    await Promise.allSettled(connections.map((connection) => connection.disconnect()));
    await server.stop(true);
  }
});
