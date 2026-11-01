import { expect, test } from "bun:test";
import { createProjectRelayConnection } from "./project-connection";

test("owners share one project socket and a change notice wakes only the owners of its document", async () => {
  const controller = new AbortController();
  let sockets = 0;
  let client: Bun.ServerWebSocket<unknown> | undefined;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        sockets++;
        client = socket;
        socket.send(JSON.stringify({ type: "ready", protocolVersion: 1 }));
      },
      message() {},
    },
  });
  const runs = { notes: 0, history: 0 };
  const settled = { notes: Promise.withResolvers<void>(), history: Promise.withResolvers<void>() };
  const project = createProjectRelayConnection({
    origin: server.url.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => ({ token: "access", expiresAt: new Date(Date.now() + 30_000).toISOString() }),
  });
  const owner = (name: keyof typeof runs, personal: boolean) => {
    const connection = project.attach({
      signal: controller.signal,
      personal,
      synchronize: async () => {
        runs[name]++;
        connection.claim(`${name}-document-0000000`);
      },
      onStatusChange: () => settled[name].resolve(),
    });
    return connection;
  };
  owner("notes", false);
  owner("history", true);
  const next = async () => {
    settled.notes = Promise.withResolvers<void>();
    settled.history = Promise.withResolvers<void>();
    await Bun.sleep(50);
  };
  try {
    await Promise.all([settled.notes.promise, settled.history.promise]);
    expect(runs).toEqual({ notes: 1, history: 1 });
    await next();
    const notice = (spaceOwner: string | null, documentId: string) =>
      client!.send(JSON.stringify({ type: "changed", spaceOwner, documentId, lastSequence: 1, stateId: null }));
    notice(null, "notes-document-0000000");
    await settled.notes.promise;
    await next();
    expect(runs).toEqual({ notes: 2, history: 1 });
    // Only the personal owner reads the personal space, so it alone looks for an unknown personal document.
    notice("account", "new-session-log-0000000");
    await settled.history.promise;
    await next();
    expect(runs).toEqual({ notes: 2, history: 2 });
    expect(sockets).toBe(1);
  } finally {
    controller.abort();
    await project.done;
    await server.stop(true);
  }
});

test("an access grant returned while aborting cannot open a socket after project shutdown", async () => {
  const controller = new AbortController();
  let sockets = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open() {
        sockets++;
      },
      message() {},
    },
  });
  const connection = createProjectRelayConnection({
    origin: server.url.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => {
      controller.abort();
      return { token: "access", expiresAt: new Date(Date.now() + 30_000).toISOString() };
    },
  });
  try {
    expect(await Promise.race([connection.done.then(() => true), Bun.sleep(200).then(() => false)])).toBe(true);
    expect(sockets).toBe(0);
  } finally {
    controller.abort();
    await server.stop(true);
    await connection.done;
  }
});

test.each([
  false,
  true,
])("manual retry is preserved before shared socket teardown finishes: %s", async (duringTeardown) => {
  const controller = new AbortController();
  const first = Promise.withResolvers<void>();
  const disconnected = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let socket: Bun.ServerWebSocket<unknown> | undefined;
  let runs = 0;
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
        client.send(JSON.stringify({ type: "ready", protocolVersion: 1 }));
      },
      message() {},
    },
  });
  const project = createProjectRelayConnection({
    origin: server.url.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => ({ token: "access", expiresAt: new Date(Date.now() + 30_000).toISOString() }),
  });
  const owner = project.attach({
    signal: controller.signal,
    synchronize: async (signal) => {
      if (++runs > 1) {
        second.resolve();
        return;
      }
      first.resolve();
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      await release.promise;
    },
    onStatusChange: () => {
      if (runs === 1 && !owner.status().connected) {
        disconnected.resolve();
        if (duringTeardown) owner.retry();
      }
    },
  });
  try {
    await first.promise;
    socket!.close();
    await disconnected.promise;
    if (!duringTeardown) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      owner.retry();
    }
    release.resolve();
    expect(await Promise.race([second.promise.then(() => true), Bun.sleep(500).then(() => false)])).toBe(true);
    expect(runs).toBe(2);
  } finally {
    release.resolve();
    controller.abort();
    await project.done;
    await server.stop(true);
  }
});
