import { expect, test } from "bun:test";
import { liveClientMessageSchema, liveProtocolVersion } from "pstdio-sync-contracts";
import { createDocumentRelayConnection } from "./document-connection";
import { createLiveConnection } from "./live";

const until = async (condition: () => boolean) => {
  const end = Date.now() + 5000;
  while (!condition() && Date.now() < end) await Bun.sleep(5);
  expect(condition()).toBe(true);
};
test.each([
  "acknowledged",
  "cancelled",
  "admitted before new topics",
] as const)("renewal owns pending replay until it is %s", async (settlement) => {
  const controller = new AbortController();
  const secondReplay = Promise.withResolvers<void>();
  const releaseReplay = Promise.withResolvers<void>();
  const lateAdmission = Promise.withResolvers<void>();
  const releaseLate = Promise.withResolvers<void>();
  const sockets = new Set<Bun.ServerWebSocket<{ generation: number; topics: Set<string> }>>();
  let opens = 0,
    ready = 0,
    runs = 0;
  const server = Bun.serve<{ generation: number; topics: Set<string> }>({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request, { data: { generation: ++opens, topics: new Set<string>() } })) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        sockets.add(socket);
        socket.send(JSON.stringify({ type: "ready", protocolVersion: liveProtocolVersion }));
      },
      async message(socket, data) {
        const message = liveClientMessageSchema.parse(JSON.parse(String(data)));
        if (message.type === "subscribe") {
          if (socket.data.generation === 2 && message.topic === "second_document_0123456789") {
            secondReplay.resolve();
            await releaseReplay.promise;
          }
          if (socket.data.generation === 2 && message.topic === "new_document_0123456789") {
            lateAdmission.resolve();
            await releaseLate.promise;
          }
          socket.data.topics.add(message.topic);
        }
        if ("requestId" in message && message.requestId)
          socket.send(JSON.stringify({ type: "control-result", requestId: message.requestId, retryAfterMs: 0 }));
      },
      close(socket) {
        sockets.delete(socket);
      },
    },
  });
  let expiresAt = 0,
    grants = 0;
  const access = async () => {
    if (expiresAt <= Date.now()) expiresAt = Date.now() + (++grants === 1 ? 3000 : 60000);
    return { token: "device", expiresAt: new Date(expiresAt).toISOString() };
  };
  const live = createLiveConnection({
    origin: server.url.origin,
    projectId: "project",
    access,
    signal: controller.signal,
  });
  const stop = live.listen((event) => {
    if (event.type === "ready") ready++;
  });
  const owner = createDocumentRelayConnection({
    origin: server.url.origin,
    projectId: "project",
    access,
    live,
    signal: controller.signal,
    synchronize: async (_signal, subscribe) => {
      runs++;
      subscribe(null, "first_document_0123456789");
      subscribe(null, "second_document_0123456789");
      if (ready === 2 && settlement === "admitted before new topics") subscribe(null, "new_document_0123456789");
    },
  });
  try {
    await until(
      () => ready === 1 && !owner.status().busy && [...sockets].some((socket) => socket.data.topics.size === 2),
    );
    await secondReplay.promise;
    await until(() => ready === 2 && runs >= 2);
    await Bun.sleep(0); // Drain's promise continuation runs; held admission cannot complete.
    expect(owner.status().busy).toBe(true);
    if (settlement === "admitted before new topics") {
      const beforeAdmission = runs;
      releaseReplay.resolve();
      await lateAdmission.promise;
      await until(() => runs > beforeAdmission && !owner.status().busy);
      // The retained subscriptions caught up while a fresh topic keeps its initial-admission semantics.
      expect([...sockets].map((socket) => socket.data.topics.size)).toEqual([2]);
    } else if (settlement === "acknowledged") {
      releaseReplay.resolve();
      await until(() => !owner.status().busy && [...sockets].some((socket) => socket.data.topics.size === 2));
      expect([...sockets].map((socket) => socket.data.topics.size)).toEqual([2]);
    } else {
      controller.abort();
      await owner.done;
      expect(owner.status().busy).toBe(false);
    }
  } finally {
    releaseReplay.resolve();
    releaseLate.resolve();
    stop();
    controller.abort();
    await Promise.all([owner.done, live.done]);
    await server.stop(true);
  }
}, 20000);
