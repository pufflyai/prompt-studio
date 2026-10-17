import { canonicalJson, relayRecoverySchema, relayRoute, type Snapshot } from "pstdio-sync-contracts";

// Owned wire peer for compiled client wiring; production relay/auth run in separate integration suites.
export const createNativeRelayPeer = (snapshot: Snapshot, onRecovery?: (operationId: string) => void) => {
  const retained = structuredClone(snapshot);
  const recover = async (request: Request) => {
    const { mutation, proof } = relayRecoverySchema.parse(await request.json());
    const receipt = retained.receipts[mutation.operationId];
    if (!receipt || receipt.recoveryProof !== proof || canonicalJson(receipt.mutation) !== canonicalJson(mutation))
      return new Response(null, { status: 403 });
    const checkpoint = { ...snapshot.checkpoint, sequence: snapshot.checkpoint.sequence + 1 };
    Object.assign(snapshot, structuredClone(retained), { checkpoint });
    snapshot.receipts[mutation.operationId]!.checkpoint = checkpoint;
    onRecovery?.(mutation.operationId);
    return Response.json(snapshot.receipts[mutation.operationId]);
  };
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
      if (route.operation === "snapshot") return Response.json(snapshot);
      if (route.operation === "recover") return recover(request);
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
