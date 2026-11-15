import { expect, test } from "bun:test";
import { Agent, get, type IncomingMessage } from "node:http";
import { createWorkspaceDiffAdmission } from "./workspace-diff-admission";

test("workspace totals leave an HTTP/1.1 connection for opening an editor", async () => {
  const release = Promise.withResolvers<void>();
  const streams: IncomingMessage[] = [];
  // Match the browser's six connections, two of which belong to live event streams.
  const agent = new Agent({ maxSockets: 6 });
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path.startsWith("/stream"))
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("data: ready\n\n"));
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (path.startsWith("/summary")) await release.promise;
      return new Response("ready");
    },
  });
  const request = (path: string, stream = false) =>
    new Promise<void>((resolve, reject) => {
      const outgoing = get(new URL(path, server.url), { agent }, (response) => {
        if (stream) {
          streams.push(response);
          resolve();
        } else {
          response.on("error", reject);
          response.on("end", resolve);
          response.resume();
        }
      });
      outgoing.on("error", reject);
    });
  const pending: Promise<void>[] = [];
  try {
    await Promise.all([request("/stream/sync", true), request("/stream/shared", true)]);
    const admit = createWorkspaceDiffAdmission();
    const signal = new AbortController().signal;
    for (let index = 0; index < 5; index++) pending.push(admit(signal, () => request(`/summary/${index}`)));
    await new Promise<void>((resolve) => setImmediate(resolve));
    pending.push(request("/editor"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    // Held optional totals must not put the person's document request in the socket queue.
    expect(
      Object.values(agent.requests)
        .flat()
        .some((request) => request?.path === "/editor"),
    ).toBe(false);
  } finally {
    release.resolve();
    await Promise.allSettled(pending);
    for (const stream of streams) stream.destroy();
    agent.destroy();
    await server.stop(true);
  }
});
