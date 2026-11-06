import { expect, test } from "bun:test";
import { createClient } from "./client";

test("native document watches share the session transport and cancel independently", async () => {
  const opened: string[] = [];
  const subscriptions: {
    subscription_id: string;
    native_document?: { project_id: string; document_key: string; room_id: string };
  }[] = [];
  const removed: string[] = [];
  const admitted = Promise.withResolvers<void>();
  const deleted = Promise.withResolvers<void>();
  const seen = Array.from({ length: 5 }, () => Promise.withResolvers<void>());
  const present = Promise.withResolvers<void>();
  const encoder = new TextEncoder();
  let shared: ReadableStreamDefaultController<Uint8Array>;
  const send = (event: string, subscription_id: string, data: unknown) =>
    shared.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify({ subscription_id, data })}\n\n`));
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/stream") || path === "/v1/session-stream") {
        opened.push(path);
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              if (path === "/v1/session-stream") {
                shared = controller;
                controller.enqueue(encoder.encode('event: connected\ndata: {"connection_id":"shared"}\n\n'));
              }
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      }
      if (request.method === "POST" && path.endsWith("/subscriptions")) {
        subscriptions.push(await request.json());
        if (subscriptions.length === 5) admitted.resolve();
      }
      if (request.method === "DELETE") {
        removed.push(path.split("/").at(-1)!);
        deleted.resolve();
      }
      return new Response(null, { status: 204 });
    },
  });
  const controllers = Array.from({ length: 5 }, () => new AbortController());
  const snapshots: unknown[][] = controllers.map(() => []);
  const presence: unknown[] = [];
  const watches: Promise<void>[] = [];
  try {
    const client = createClient({ baseUrl: server.url.origin });
    for (const [index, controller] of controllers.entries())
      watches.push(
        client.nativeDocuments.watch({
          projectId: index === 4 ? "other-project" : "project",
          documentKey: "a".repeat(64),
          roomId: `room-${index}`,
          signal: controller.signal,
          onSnapshot: (snapshot) => {
            snapshots[index]!.push(snapshot);
            seen[index]!.resolve();
          },
          onPresence: (snapshot) => {
            presence.push(snapshot);
            present.resolve();
          },
        }),
      );
    await admitted.promise;
    expect(opened).toEqual(["/v1/session-stream"]);
    expect(
      subscriptions.map((input) => input.native_document).sort((a, b) => a!.room_id.localeCompare(b!.room_id)),
    ).toEqual(
      controllers.map((_, index) => ({
        project_id: index === 4 ? "other-project" : "project",
        document_key: "a".repeat(64),
        room_id: `room-${index}`,
      })),
    );
    const id = (index: number) =>
      subscriptions.find((item) => item.native_document?.room_id === `room-${index}`)!.subscription_id;
    const snapshot = { state: "AQI=", seedId: "seed", sourceSeedId: "source" };
    send("document", id(0), snapshot);
    send("presence", id(0), { participantId: crypto.randomUUID(), participants: [] });
    await Promise.all([seen[0]!.promise, present.promise]);
    expect(snapshots[0]).toEqual([{ ...snapshot, state: new Uint8Array([1, 2]), sourceState: undefined }]);
    expect(presence).toHaveLength(1);
    controllers[0]!.abort(new DOMException("Cancelled", "AbortError"));
    await watches[0];
    await deleted.promise;
    expect(removed).toEqual([id(0)]);
    send("document", id(1), snapshot);
    await seen[1]!.promise;
    expect(snapshots[1]).toHaveLength(1);
    expect(opened).toHaveLength(1);
  } finally {
    for (const controller of controllers) controller.abort();
    await Promise.allSettled(watches);
    await server.stop(true);
  }
});
