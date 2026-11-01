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
  const { createDocumentRelayConnection } = await import("./project-connection");
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

test("transport status follows the socket through offline and back and signals each change", async () => {
  const controller = new AbortController();
  let socket: Bun.ServerWebSocket<unknown> | undefined;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(client) {
        socket = client;
        client.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
      },
      message() {},
    },
  });
  const changes: { connected: boolean; busy: boolean }[] = [];
  let signalled = () => {};
  const signal = (count: number) => {
    const reached = Promise.withResolvers<void>();
    signalled = () => {
      if (changes.length >= count) reached.resolve();
    };
    signalled();
    return reached.promise;
  };
  const connection = createRelayConnection({
    origin: server.url.origin,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    access: async () => ({ token: "fixture-access", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    signal: controller.signal,
    synchronize: async () => {},
    onStatusChange: () => {
      changes.push(connection.status());
      signalled();
    },
  });
  try {
    // Opening the socket, then the end of the first run.
    await signal(2);
    expect(changes).toEqual([
      { connected: true, busy: false },
      { connected: true, busy: false },
    ]);
    // A closed socket is how the relay looks when the network drops.
    socket?.close();
    await signal(3);
    expect(changes[2]).toEqual({ connected: false, busy: false });
    // The connection retries, opens again and runs once more.
    await signal(5);
    expect(changes.slice(3)).toEqual([
      { connected: true, busy: false },
      { connected: true, busy: false },
    ]);
  } finally {
    controller.abort();
    await server.stop(true);
    await connection.done;
  }
});

test.each([false, true])("retry reconnects before backoff, including during teardown: %s", async (duringTeardown) => {
  const controller = new AbortController();
  const first = Promise.withResolvers<void>();
  const disconnected = Promise.withResolvers<void>();
  const reconnected = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let socket: Bun.ServerWebSocket<unknown> | undefined;
  let attempts = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(client) {
        socket = client;
        client.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
      },
      message() {},
    },
  });
  const connection = createRelayConnection({
    origin: server.url.origin,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    access: async () => ({ token: "access", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    signal: controller.signal,
    synchronize: async (signal) => {
      if (++attempts > 1) {
        reconnected.resolve();
        return;
      }
      first.resolve();
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      if (duringTeardown) await release.promise;
    },
    onStatusChange: () => {
      if (attempts === 1 && !connection.status().connected) {
        disconnected.resolve();
        if (duringTeardown) connection.retry();
      }
    },
  });
  try {
    await first.promise;
    socket?.close();
    await disconnected.promise;
    if (!duringTeardown) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      connection.retry();
    }
    release.resolve();
    const result = await Promise.race([reconnected.promise.then(() => true), Bun.sleep(500).then(() => false)]);
    expect(result).toBe(true);
    expect(attempts).toBe(2);
  } finally {
    release.resolve();
    controller.abort();
    await connection.done;
    await server.stop(true);
  }
});

test("a planned access renewal reconnects at once without reporting the connection offline", async () => {
  const controller = new AbortController();
  let opens = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(client) {
        opens++;
        client.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
      },
      message() {},
    },
  });
  const changes: { connected: boolean; busy: boolean }[] = [];
  const connection = createRelayConnection({
    origin: server.url.origin,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    access: async () => ({ token: "short-access", expiresAt: new Date(Date.now() + 200).toISOString() }),
    signal: controller.signal,
    synchronize: async () => {},
    onStatusChange: () => changes.push(connection.status()),
  });
  try {
    // Four access lifetimes: each renewal reconnects without the one-second failure backoff.
    await Bun.sleep(900);
    expect(opens).toBeGreaterThanOrEqual(4);
    expect(changes.some((change) => !change.connected)).toBe(false);
  } finally {
    controller.abort();
    await server.stop(true);
    await connection.done;
  }
});

test("retry during access renewal synchronizes after the renewed socket is ready", async () => {
  const controller = new AbortController();
  const synchronized = Promise.withResolvers<void>();
  let firstSignal: AbortSignal | undefined;
  let retried = false;
  let accesses = 0;
  let opens = 0;
  let synchronizations = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        opens++;
        socket.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
      },
      message() {},
    },
  });
  const connection = createRelayConnection({
    origin: server.url.origin,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    access: async () => ({
      token: "renewal-access",
      expiresAt: new Date(Date.now() + (++accesses === 1 ? 100 : 30_000)).toISOString(),
    }),
    signal: controller.signal,
    synchronize: async (signal) => {
      if (++synchronizations > 1) {
        synchronized.resolve();
        return;
      }
      firstSignal = signal;
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    },
    onStatusChange: () => {
      if (firstSignal?.aborted && connection.status().connected && !retried) {
        retried = true;
        connection.retry();
      }
    },
  });
  try {
    const result = await Promise.race([synchronized.promise.then(() => true), Bun.sleep(500).then(() => false)]);
    expect(opens).toBe(2);
    expect(retried).toBe(true);
    expect(result).toBe(true);
    expect(synchronizations).toBe(2);
  } finally {
    controller.abort();
    await connection.done;
    await server.stop(true);
  }
});
