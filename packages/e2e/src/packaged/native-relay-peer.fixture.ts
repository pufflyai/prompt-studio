import {
  canonicalJson,
  coverageAckSchema,
  type Mutation,
  type RelayOperation,
  relayRecoverySchema,
  relayRoute,
  type Snapshot,
  snapshotFingerprint,
  validateMutation,
} from "pstdio-sync-contracts";

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
export const createNativeRelayPeer = (
  snapshot: Snapshot,
  bytes?: Uint8Array,
  onRecovery?: (operationId: string) => void,
  onSnapshot?: (snapshot: Snapshot) => void,
  onSubmit?: (mutation: Mutation) => Response,
) => {
  const retained = structuredClone(snapshot);
  const recover = async (request: Request) => {
    const { mutation, proof } = relayRecoverySchema.parse(await request.json());
    const receipt = retained.receipts[mutation.operationId];
    if (!receipt || receipt.recoveryProof !== proof || canonicalJson(receipt.mutation) !== canonicalJson(mutation))
      return new Response(null, { status: 403 });
    if (mutation.epoch !== snapshot.checkpoint.epoch || mutation.generation !== snapshot.generation)
      return new Response(null, { status: 409 });
    onRecovery?.(mutation.operationId);
    return Response.json(snapshot.receipts[mutation.operationId]);
  };
  const environmentAccess = (request: Request) => {
    if (request.headers.get("authorization") !== "Bearer owned-renewal-fixture")
      return new Response(null, { status: 401 });
    return Response.json({ token: "owned-access-fixture", expiresAt: new Date(Date.now() + 30_000).toISOString() });
  };
  const data = async (operation: RelayOperation, request: Request) => {
    switch (operation) {
      case "snapshot":
      case "initialize":
        onSnapshot?.(snapshot);
        return Response.json(snapshot);
      case "acknowledge": {
        const ack = coverageAckSchema.parse(await request.json());
        if (ack.snapshotHash !== (await snapshotFingerprint(snapshot)))
          return Response.json({ status: "snapshot-required" });
        return Response.json({ status: "acknowledged", acknowledgement: ack });
      }
      case "assets/read":
        return readAsset(request, bytes);
      case "assets/begin": {
        if (!bytes) return new Response(null, { status: 404 });
        const { asset } = (await request.json()) as { asset: unknown };
        return Response.json({ asset, partSize: 5 * 1024 * 1024, completed: true, parts: [] });
      }
      case "recover":
        return recover(request);
      case "submit":
        return onSubmit?.(await validateMutation(await request.json())) ?? new Response(null, { status: 404 });
      default:
        return new Response(null, { status: 404 });
    }
  };
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request, server) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/environment-access") return environmentAccess(request);
      if (request.headers.get("authorization") !== "Bearer owned-access-fixture")
        return new Response(null, { status: 401 });
      const route = relayRoute(path);
      if (!route) return new Response(null, { status: 404 });
      if (route.workbenchId !== snapshot.scope.workbenchId || route.extensionId !== snapshot.scope.extensionId)
        return new Response(null, { status: 404 });
      if (route.operation === "changes" && server.upgrade(request)) return;
      return data(route.operation, request);
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ protocolVersion: 2, type: "ready" }));
      },
      message() {},
    },
  });
};
