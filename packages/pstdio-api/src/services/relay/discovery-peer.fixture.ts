import type { ServerWebSocket } from "bun";
import { relayRoute, type Snapshot } from "pstdio-sync-contracts";

export const discoveryPeer = (accountId: string) => {
  const assets = new Map<string, Uint8Array>();
  const snapshots = new Map<string, Snapshot>();
  const sockets = new Set<ServerWebSocket<{ extensionId: string }>>();
  const opened: string[] = [];
  const readAsset = async (request: Request) => {
    const { asset, offset } = (await request.json()) as { asset: { sha256: string }; offset: number };
    const bytes = assets.get(asset.sha256);
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(bytes.slice(offset), {
      headers: { "x-pstdio-offset": String(offset), "x-pstdio-byte-length": String(bytes.length - offset) },
    });
  };
  const peer = Bun.serve<{ extensionId: string }>({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request, server) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/environment-access")
        return Response.json({ token: "owned-access", expiresAt: new Date(Date.now() + 30_000).toISOString() });
      const route = relayRoute(path);
      if (!route) return new Response(null, { status: 404 });
      if (route.operation === "assets/read") return readAsset(request);
      const key = JSON.stringify([route.workbenchId, route.extensionId]);
      if (route.operation === "initialize") {
        const input = (await request.json()) as { publishedRevision: string };
        if (!snapshots.has(key))
          snapshots.set(key, {
            protocolVersion: 2,
            generation: 0,
            covered: 0,
            writers: {},
            documents: {},
            retainedBranches: [],
            scope: { accountId, workbenchId: route.workbenchId, extensionId: route.extensionId },
            publishedRevision: input.publishedRevision,
            checkpoint: { epoch: crypto.randomUUID(), sequence: 0 },
            journalSequence: 0,
            records: {},
            receipts: {},
            conflicts: {},
          });
      }
      if (route.operation === "changes" && server.upgrade(request, { data: { extensionId: route.extensionId } }))
        return;
      const snapshot = snapshots.get(key);
      if (snapshot && (route.operation === "snapshot" || route.operation === "initialize"))
        return Response.json(snapshot);
      return new Response(null, { status: 404 });
    },
    websocket: {
      open(socket) {
        sockets.add(socket);
        opened.push(socket.data.extensionId);
        socket.send(JSON.stringify({ protocolVersion: 2, type: "ready" }));
      },
      message() {},
      close(socket) {
        sockets.delete(socket);
      },
    },
  });
  return {
    peer,
    opened,
    connected: () => [...sockets].map((socket) => socket.data.extensionId).sort(),
    snapshots,
    assets,
    wake: () => {
      for (const socket of sockets) socket.send(JSON.stringify({ protocolVersion: 2, type: "changed" }));
    },
  };
};
