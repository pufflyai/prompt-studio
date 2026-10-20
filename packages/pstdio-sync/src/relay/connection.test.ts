import { expect, test } from "bun:test";
import { createRelayConnection } from "./connection";

test("a closed socket cancels stalled synchronization before reconnecting without overlapping work", async () => {
  const controller = new AbortController();
  const stalled = Promise.withResolvers<void>();
  const synchronized = Promise.withResolvers<void>();
  let attempts = 0;
  let active = 0;
  let maximum = 0;
  let cancelled = false;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (new URL(request.url).pathname.endsWith("/changes")) {
        if (server.upgrade(request)) return;
        return new Response(null, { status: 426 });
      }
      if (attempts > 1) return new Response("complete");
      return new Response(
        new ReadableStream({
          start(stream) {
            stream.enqueue(new TextEncoder().encode("started"));
            stalled.resolve();
          },
        }),
      );
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
        if (attempts === 0) void stalled.promise.then(() => socket.close());
      },
      message() {},
    },
  });
  const connection = createRelayConnection({
    origin: server.url.origin,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    access: async () => ({ token: "fixture-access", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    signal: controller.signal,
    synchronize: async (signal: AbortSignal) => {
      attempts++;
      active++;
      maximum = Math.max(maximum, active);
      try {
        const response = await fetch(new URL("/snapshot", server.url), { signal });
        expect(await response.text()).toBe("complete");
        synchronized.resolve();
      } catch (error) {
        cancelled = Boolean(signal?.aborted);
        throw error;
      } finally {
        active--;
      }
    },
  });
  try {
    const result = await Promise.race([synchronized.promise.then(() => true), Bun.sleep(2_000).then(() => false)]);
    expect(result).toBe(true);
    expect(cancelled).toBe(true);
    expect(attempts).toBe(2);
    expect(maximum).toBe(1);
  } finally {
    controller.abort();
    await server.stop(true);
    await connection.done;
  }
});

test("separate wakes on one connection reuse the attempt signal", async () => {
  const { createDocumentRelayConnection } = await import("./connection");
  const controller = new AbortController();
  const first = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const signals: AbortSignal[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ type: "ready", protocolVersion: 1 }));
      },
      message() {},
    },
  });
  const connection = createDocumentRelayConnection({
    origin: server.url.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => ({ token: "access", expiresAt: new Date(Date.now() + 30_000).toISOString() }),
    synchronize: async (signal) => {
      signals.push(signal);
      if (signals.length === 1) first.resolve();
      else second.resolve();
    },
  });
  try {
    await first.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    connection.wake();
    await second.promise;
    expect(signals[0]).toBe(signals[1]);
  } finally {
    controller.abort();
    await connection.done;
    await server.stop(true);
  }
});
