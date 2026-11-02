import { type LiveServerMessage, liveClientMessageSchema, liveProtocolVersion } from "pstdio-sync-contracts";
import { createLiveConnection } from "./live";

export const documentConnectionFixture = (
  options: { heldTopic?: string; access?: () => Promise<{ token: string; expiresAt: string }> } = {},
) => {
  const controller = new AbortController();
  const sockets = new Set<Bun.ServerWebSocket<undefined>>();
  const held = Promise.withResolvers<void>();
  let heldControl: { socket: Bun.ServerWebSocket<undefined>; requestId: string } | undefined;
  let readyCount = 0;
  const renewed = Promise.withResolvers<void>();
  const access =
    options.access ?? (async () => ({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() }));
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        sockets.add(socket);
        socket.send(JSON.stringify({ type: "ready", protocolVersion: liveProtocolVersion }));
      },
      message(socket, data) {
        const frame = liveClientMessageSchema.parse(JSON.parse(String(data)));
        if (!("requestId" in frame) || !frame.requestId) return;
        if (frame.type === "subscribe" && frame.topic === options.heldTopic) {
          heldControl = { socket, requestId: frame.requestId };
          held.resolve();
          return;
        }
        socket.send(JSON.stringify({ type: "control-result", requestId: frame.requestId, retryAfterMs: 0 }));
      },
      close(socket) {
        sockets.delete(socket);
      },
    },
  });
  const live = createLiveConnection({
    origin: server.url.origin,
    projectId: "project",
    access,
    signal: controller.signal,
  });
  live.listen((event) => {
    if (event.type === "ready" && ++readyCount === 2) renewed.resolve();
  });
  return {
    live,
    access,
    controller,
    origin: server.url.origin,
    held: held.promise,
    renewed: renewed.promise,
    admit() {
      if (heldControl)
        heldControl.socket.send(
          JSON.stringify({ type: "control-result", requestId: heldControl.requestId, retryAfterMs: 0 }),
        );
    },
    send(message: LiveServerMessage) {
      for (const socket of sockets) socket.send(JSON.stringify(message));
    },
    async close() {
      controller.abort();
      await live.done;
      await server.stop(true);
    },
  };
};
