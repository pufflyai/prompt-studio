import { expect, test } from "bun:test";
import { liveClientMessageSchema, syncProtocolVersion } from "pstdio-sync-contracts";
import { createSyncSpace, openLive, sealLive } from "../encryption";
import { createDocumentRelayConnection } from "./connection";

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
