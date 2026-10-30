import { expect, test } from "bun:test";
import { createRelayConnection } from "./connection";

test("credential rotation opens a fresh socket while durable synchronization is still running", async () => {
  const controller = new AbortController();
  const release = Promise.withResolvers<void>();
  const rotated = Promise.withResolvers<void>();
  const started = Promise.withResolvers<AbortSignal>();
  const reasons: string[] = [];
  let grants = 0;
  let sockets = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
      },
      message() {},
    },
  });
  const connection = createRelayConnection({
    origin: server.url.origin,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    signal: controller.signal,
    access: async () => ({
      token: `grant-${++grants}`,
      expiresAt: new Date(Date.now() + (grants === 1 ? 100 : 60_000)).toISOString(),
    }),
    synchronize: async (signal) => {
      started.resolve(signal);
      await release.promise;
    },
    onReady: () => {
      if (++sockets === 2) rotated.resolve();
    },
    onDisconnect: (reason) => {
      reasons.push(reason);
    },
  });
  try {
    const signal = await started.promise;
    await rotated.promise;
    expect(signal.aborted).toBe(false);
    expect(reasons).toEqual(["renewal"]);
  } finally {
    release.resolve();
    controller.abort();
    await connection.done;
    await server.stop(true);
  }
});

test("denied renewal cancels durable synchronization and reports an offline connection", async () => {
  const controller = new AbortController();
  const offline = Promise.withResolvers<void>();
  const started = Promise.withResolvers<AbortSignal>();
  let grants = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
      },
      message() {},
    },
  });
  const connection = createRelayConnection({
    origin: server.url.origin,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    signal: controller.signal,
    access: async () => {
      if (++grants > 1) throw new Error("Access revoked");
      return { token: "grant", expiresAt: new Date(Date.now() + 100).toISOString() };
    },
    synchronize: async (signal) => {
      started.resolve(signal);
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    },
    onDisconnect: (reason) => {
      if (reason === "offline") offline.resolve();
    },
  });
  try {
    const signal = await started.promise;
    await offline.promise;
    expect(signal.aborted).toBe(true);
    expect(grants).toBe(2);
  } finally {
    controller.abort();
    await connection.done;
    await server.stop(true);
  }
});

test("an expired access grant uses the failure path without opening a socket", async () => {
  const controller = new AbortController();
  const offline = Promise.withResolvers<void>();
  let grants = 0;
  const connection = createRelayConnection({
    origin: "http://127.0.0.1:1",
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    signal: controller.signal,
    access: async () => {
      grants++;
      return { token: "expired", expiresAt: new Date(0).toISOString() };
    },
    synchronize: async () => {
      throw new Error("Expired access must not synchronize");
    },
    onDisconnect: (reason) => {
      expect(reason).toBe("offline");
      offline.resolve();
    },
  });
  try {
    await offline.promise;
    await new Promise((resolve) => setImmediate(resolve));
    expect(grants).toBe(1);
  } finally {
    controller.abort();
    await connection.done;
  }
});

test("credential renewal keeps the current synchronization attempt", async () => {
  const controller = new AbortController();
  const renewed = Promise.withResolvers<void>();
  const signals: AbortSignal[] = [];
  let grants = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
      },
      message() {},
    },
  });
  const connection = createRelayConnection({
    origin: server.url.origin,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    signal: controller.signal,
    access: async () => ({
      token: `grant-${++grants}`,
      expiresAt: new Date(Date.now() + (grants === 1 ? 100 : 60_000)).toISOString(),
    }),
    synchronize: async (signal) => {
      signals.push(signal);
      if (signals.length === 2) renewed.resolve();
    },
  });
  try {
    await renewed.promise;
    expect(signals[0]).toBe(signals[1]);
    expect(signals[0].aborted).toBe(false);
  } finally {
    controller.abort();
    await connection.done;
    await server.stop(true);
  }
});

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

test("a permanent synchronization error during access renewal retires its attempt", async () => {
  const controller = new AbortController();
  const firstStarted = Promise.withResolvers<AbortSignal>();
  const secondStarted = Promise.withResolvers<AbortSignal>();
  const renewalEntered = Promise.withResolvers<void>();
  const renewedGrant = Promise.withResolvers<void>();
  const failSync = Promise.withResolvers<void>();
  const reported = Promise.withResolvers<void>();
  let grants = 0,
    runs = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
      },
      message() {},
    },
  });
  const connection = createRelayConnection({
    origin: server.url.origin,
    scope: { accountId: "a", workbenchId: "w", extensionId: "e" },
    signal: controller.signal,
    access: async () => {
      const n = ++grants;
      if (n === 2) {
        renewalEntered.resolve();
        await renewedGrant.promise;
      }
      return { token: `t-${n}`, expiresAt: new Date(Date.now() + (n === 1 ? 60 : 60_000)).toISOString() };
    },
    synchronize: async (signal) => {
      if (++runs === 1) {
        firstStarted.resolve(signal);
        await failSync.promise;
        throw new Error("Permanent synchronization failure");
      }
      secondStarted.resolve(signal);
    },
    onError: () => reported.resolve(),
  });
  try {
    const first = await firstStarted.promise;
    await renewalEntered.promise;
    failSync.resolve();
    await reported.promise;
    await new Promise<void>((r) => setImmediate(r));
    renewedGrant.resolve();
    const second = await secondStarted.promise;
    expect(first.aborted).toBe(true);
    expect(second).not.toBe(first);
  } finally {
    failSync.resolve();
    renewedGrant.resolve();
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
