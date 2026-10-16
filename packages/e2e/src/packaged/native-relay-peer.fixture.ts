import { relayRoute, type Snapshot } from "pstdio-sync-contracts";

const readAsset = async (request: Request, bytes: Uint8Array | undefined) => {
  if (!bytes) return new Response(null, { status: 404 });
  const { offset } = (await request.json()) as { offset: number };
  return new Response(bytes.slice(offset), {
    headers: {
      "x-pstdio-offset": String(offset),
      "x-pstdio-byte-length": String(bytes.byteLength - offset),
    },
  });
};

// Owned wire peer for compiled client wiring; production relay/auth run in separate integration suites.
export const createNativeRelayPeer = (snapshot: Snapshot, bytes?: Uint8Array) => {
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request, server) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/environment-access") {
        if (request.headers.get("authorization") !== "Bearer owned-renewal-fixture")
          return new Response(null, { status: 401 });
        return Response.json({
          token: "owned-access-fixture",
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
        });
      }
      if (request.headers.get("authorization") !== "Bearer owned-access-fixture")
        return new Response(null, { status: 401 });
      const route = relayRoute(path);
      if (!route) return new Response(null, { status: 404 });
      if (route.workbenchId !== snapshot.scope.workbenchId || route.extensionId !== snapshot.scope.extensionId)
        return new Response(null, { status: 404 });
      if (route.operation === "changes" && server.upgrade(request)) return;
      if (route.operation === "snapshot" || route.operation === "initialize") return Response.json(snapshot);
      if (route.operation === "assets/read") return readAsset(request, bytes);
      return new Response(null, { status: 404 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ protocolVersion: 1, type: "ready" }));
      },
      message() {},
    },
  });
};
