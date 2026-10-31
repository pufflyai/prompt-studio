import { expect, test } from "bun:test";
import { liveClientMessageSchema, syncProtocolVersion } from "pstdio-sync-contracts";
import { createSyncSpace, openLive, sealLive } from "../encryption/index";
import { createDocumentRelayConnection } from "./connection";

test("a document change starts independently while background synchronization stays held", async () => {
  const controller = new AbortController();
  const background = Promise.withResolvers<void>();
  const foreground = Promise.withResolvers<void>();
  const observed = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  let targetRuns = 0;
  let backgroundRuns = 0;
  const documentId = "known_document_0123456789";
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ type: "ready", protocolVersion: syncProtocolVersion }));
      },
      message(socket) {
        for (let index = 0; index < 100; index++)
          socket.send(
            JSON.stringify({
              type: "changed",
              spaceOwner: null,
              documentId: `unknown_document_${index}`,
              lastSequence: 1,
              stateId: null,
            }),
          );
        socket.send(JSON.stringify({ type: "changed", spaceOwner: null, documentId, lastSequence: 1, stateId: null }));
        socket.send(JSON.stringify({ type: "live", spaceOwner: null, deviceId: "peer", payload: "AA==" }));
      },
    },
  });
  const connection = createDocumentRelayConnection({
    origin: server.url.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => ({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    synchronize: async () => {
      backgroundRuns++;
      entered.resolve();
      await background.promise;
    },
    acceptsChange: (change) => change.spaceOwner === null && change.documentId === documentId,
    synchronizeChanged: async (change, signal) => {
      expect(change.documentId).toBe(documentId);
      expect(signal.aborted).toBe(false);
      targetRuns++;
      await foreground.promise;
      return true;
    },
    onLive: () => observed.resolve(),
  });
  try {
    await entered.promise;
    connection.send({ type: "live", spaceOwner: null, payload: "AA==" });
    await observed.promise;
    expect(targetRuns).toBe(1);
    expect(backgroundRuns).toBe(1);
    foreground.resolve();
  } finally {
    foreground.resolve();
    background.resolve();
    controller.abort();
    await connection.done;
    await server.stop(true);
  }
});

test("closing a connection aborts and drains admitted document work before completing", async () => {
  const controller = new AbortController();
  const started = Promise.withResolvers<AbortSignal>();
  const aborted = Promise.withResolvers<void>();
  const cleaned = Promise.withResolvers<void>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ type: "ready", protocolVersion: syncProtocolVersion }));
        socket.send(
          JSON.stringify({
            type: "changed",
            spaceOwner: null,
            documentId: "known_document_0123456789",
            lastSequence: 1,
            stateId: null,
          }),
        );
      },
      message() {},
    },
  });
  const connection = createDocumentRelayConnection({
    origin: server.url.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => ({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    synchronize: async () => {},
    synchronizeChanged: async (_change, signal) => {
      started.resolve(signal);
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      aborted.resolve();
      await cleaned.promise;
      return true;
    },
  });
  let done = false;
  void connection.done.then(() => {
    done = true;
  });
  try {
    const signal = await started.promise;
    controller.abort();
    await aborted.promise;
    expect(signal.aborted).toBe(true);
    expect(done).toBe(false);
    cleaned.resolve();
    await connection.done;
    expect(done).toBe(true);
  } finally {
    cleaned.resolve();
    controller.abort();
    await connection.done;
    await server.stop(true);
  }
});

test("encrypted live messages cross the socket during durable synchronization without waking it", async () => {
  const controller = new AbortController();
  const syncing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const received = Promise.withResolvers<{ deviceId: string; payload: string }>();
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: null,
    keys: [
      {
        generation: 1,
        secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
      },
    ],
  });
  const plaintext = new TextEncoder().encode("Private participant and selection");
  let synchronizations = 0;
  const packets: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ type: "ready", protocolVersion: syncProtocolVersion }));
      },
      message(socket, packet) {
        packets.push(String(packet));
        const frame = liveClientMessageSchema.parse(JSON.parse(String(packet)));
        socket.send(JSON.stringify({ ...frame, deviceId: "sender" }));
      },
    },
  });
  const connection = createDocumentRelayConnection({
    origin: server.url.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => ({ token: "local-fixture-access", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    synchronize: async () => {
      synchronizations++;
      syncing.resolve();
      await release.promise;
    },
    onLive: (frame) => received.resolve(frame),
  });
  try {
    await syncing.promise;
    const sealed = await sealLive(space, "sender", plaintext);
    expect(connection.send(sealed)).toBe(true);
    const frame = await received.promise;
    expect(await openLive(space, frame)).toEqual(plaintext);
    expect(packets.join("")).not.toContain("Private participant");
    expect(connection.status().busy).toBe(true);
    release.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(synchronizations).toBe(1);
    controller.abort();
    expect(connection.send(sealed)).toBe(false);
  } finally {
    release.resolve();
    controller.abort();
    await connection.done;
    await server.stop(true);
  }
});
