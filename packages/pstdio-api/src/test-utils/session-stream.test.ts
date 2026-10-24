import { expect, test } from "bun:test";
import { openSessionStream } from "./session-stream";

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

test("session stream replay keeps reading through consecutive heartbeats", async () => {
  const encoder = new TextEncoder();
  const chunks = [
    sse("connected", { connection_id: "c1" }),
    sse("heartbeat", { timestamp: 1 }),
    sse("heartbeat", { timestamp: 2 }),
    sse("patch", { data: "after heartbeats" }),
  ];
  // Each heartbeat must arrive while the replay is already waiting for the next event.
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await Bun.sleep(50);
      }
    },
  });
  const app = { request: (path: string) => new Response(path === "/v1/session-stream" ? body : null) };

  const reader = (await openSessionStream(app, "s1")).body!.getReader();
  const read = await Promise.race([reader.read(), Bun.sleep(1_000).then(() => null)]);

  expect(read && new TextDecoder().decode(read.value)).toBe(sse("patch", "after heartbeats"));
});
