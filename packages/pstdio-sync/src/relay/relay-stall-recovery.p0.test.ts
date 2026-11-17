import { expect, test } from "bun:test";
import { createDocumentRelayConnection } from "./document-connection";
import { documentConnectionFixture } from "./document-connection.test-fixture";
import { createDocumentRelay } from "./document-http";
import { fetchWithInactivity } from "./inactivity-response";

for (const phase of ["headers", "body"] as const)
  test(`a relay stalled at ${phase} cancels its request and preserves the read checkpoint`, async () => {
    const controller = new AbortController();
    const release = Promise.withResolvers<void>();
    const after: number[] = [];
    let requests = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        after.push((await request.json()).after);
        if (++requests > 1)
          return Response.json({ status: "updates", state: null, lastSequence: 7, updates: [], more: false });
        if (phase === "headers") {
          await release.promise;
          return new Response();
        }
        return new Response(
          new ReadableStream({
            start(stream) {
              stream.enqueue(new TextEncoder().encode('{"status":'));
            },
          }),
        );
      },
    });
    const relay = createDocumentRelay({
      origin: server.url.origin,
      space: { projectId: "project", spaceOwner: null },
      documentId: "document_0123456789abcdef",
      token: async () => "fixture",
      signal: controller.signal,
      inactivityMs: 40,
    });
    try {
      await expect(relay.read(7)).rejects.toThrow("no progress");
      expect(await relay.read(7)).toMatchObject({ lastSequence: 7 });
      expect(after).toEqual([7, 7]);
    } finally {
      controller.abort();
      release.resolve();
      await server.stop(true);
    }
  });

test("a response making byte progress can exceed the inactivity interval", async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ status: "updates", state: null, lastSequence: 0, updates: [], more: false }),
  );
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      new Response(
        new ReadableStream({
          async start(stream) {
            for (let offset = 0; offset < bytes.length; offset += 12) {
              stream.enqueue(bytes.subarray(offset, offset + 12));
              await Bun.sleep(15);
            }
            stream.close();
          },
        }),
      ),
  });
  try {
    const relay = createDocumentRelay({
      origin: server.url.origin,
      space: { projectId: "project", spaceOwner: null },
      documentId: "document_0123456789abcdef",
      token: async () => "fixture",
      signal: new AbortController().signal,
      inactivityMs: 60,
    });
    expect(await relay.read(0)).toMatchObject({ lastSequence: 0 });
  } finally {
    await server.stop(true);
  }
});

test("scoped recovery cancels and drains the previous attempt before starting another owner pass", async () => {
  const f = documentConnectionFixture();
  const entered = Promise.withResolvers<void>(),
    cancelled = Promise.withResolvers<void>(),
    cleanup = Promise.withResolvers<void>(),
    resumed = Promise.withResolvers<void>();
  let runs = 0;
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    synchronize: async (signal) => {
      if (++runs > 1) {
        resumed.resolve();
        return;
      }
      entered.resolve();
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      cancelled.resolve();
      await cleanup.promise;
    },
  });
  try {
    await entered.promise;
    const retry = owner.restart();
    await cancelled.promise;
    expect(runs).toBe(1);
    expect(f.live.status().connected).toBe(true);
    cleanup.resolve();
    await retry;
    await resumed.promise;
    expect(runs).toBe(2);
  } finally {
    cleanup.resolve();
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});

test("a buffered upload keeps going while the peer receives bytes beyond the response inactivity interval", async () => {
  let received = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const reader = request.body!.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        received += chunk.value.byteLength;
        await Bun.sleep(10);
      }
      return new Response("accepted");
    },
  });
  const controller = new AbortController();
  const bytes = new Uint8Array(20 * 1024 * 1024);
  try {
    const response = await fetchWithInactivity(
      new URL(server.url),
      { method: "POST", body: bytes },
      {
        signal: controller.signal,
        inactivityMs: 50,
        uploading: true,
      },
    );
    expect(await response.text()).toBe("accepted");
    expect(received).toBe(bytes.length);
  } finally {
    controller.abort();
    await server.stop(true);
  }
});

test("source restart drains admitted background work and refuses new admissions until it settles", async () => {
  const f = documentConnectionFixture();
  const entered = Promise.withResolvers<void>(),
    resumed = Promise.withResolvers<void>(),
    cleanup = Promise.withResolvers<void>();
  let runs = 0;
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    synchronize: async () => {
      if (++runs === 1) entered.resolve();
      else resumed.resolve();
    },
  });
  try {
    await entered.promise;
    const background = owner.admit(() => cleanup.promise);
    const retry = owner.restart();
    expect(runs).toBe(1);
    await expect(
      owner.admit(async () => {
        throw new Error("must not start");
      }),
    ).rejects.toThrow("restarting");
    expect(f.live.status().connected).toBe(true);
    cleanup.resolve();
    await Promise.all([background, retry, resumed.promise]);
    expect(runs).toBe(2);
  } finally {
    cleanup.resolve();
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});
