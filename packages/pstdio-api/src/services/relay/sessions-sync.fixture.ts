import { type SyncRoute, syncBlobReferencesFeature, syncRoute } from "pstdio-sync-contracts";
import { numberRelayFixture } from "./resource-number-sync.fixture";

export const sessionsSyncFixture = () => {
  const relay = numberRelayFixture();
  const blobs = new Map<string, Uint8Array>();
  const offsets: number[] = [];
  const held = Promise.withResolvers<void>();
  const keys = [{ generation: 1, secret: "A".repeat(43) }];
  let pause = false;
  const readBlob = async (route: Extract<SyncRoute, { kind: "blob" }>, request: Request) => {
    if (route.operation === "begin" || route.operation === "begin-manifest")
      return Response.json({ partSize: 1_048_576, parts: [], completed: blobs.has(route.blobId) });
    if (route.operation === "finish") return new Response(null);
    const { offset } = await request.json();
    const bytes = blobs.get(route.blobId)!;
    if (bytes.length < 400) offsets.push(offset);
    if (pause && bytes.length < 400) {
      pause = false;
      return new Response(
        new ReadableStream({
          start(stream) {
            stream.enqueue(bytes.slice(offset, offset + 32));
            held.resolve();
          },
        }),
      );
    }
    return new Response(bytes.slice(offset));
  };
  const readDocument = async (route: Extract<SyncRoute, { kind: "document" | "state" }>, request: Request) => {
    const target = relay.relay(route.documentId);
    if (route.kind === "state") return new Response(new Uint8Array(await target.state({} as never)));
    const body = await request.json();
    if (route.operation === "updates") return Response.json(await target.update(body));
    if (route.operation === "state") {
      if (!(await target.replace(body))) return Response.json({ error: "stale-state", state: null }, { status: 409 });
      const state = { ...(await target.read(0)).state };
      delete (state as { payload?: string }).payload;
      delete (state as { blobIds?: string[] }).blobIds;
      return Response.json({ state });
    }
    const result = await target.read(body.after);
    // The wire state has no ciphertext payload: that travels on the state route.
    const state = result.state ? { ...result.state } : null;
    if (state) delete (state as { payload?: string }).payload;
    if (state) delete (state as { blobIds?: string[] }).blobIds;
    const updates =
      result.status === "updates"
        ? result.updates.map(({ sequence, updateId, payload, deviceId, createdAt }) => ({
            sequence,
            updateId,
            payload,
            deviceId,
            createdAt,
          }))
        : undefined;
    return Response.json({ ...result, state, ...(updates ? { updates } : {}) });
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/keys")) return Response.json({ project: keys, personal: keys });
      const route = syncRoute(url.pathname);
      if (!route) return new Response(null, { status: 404 });
      if (route.kind === "capabilities")
        return Response.json({ protocolVersion: 1, features: [syncBlobReferencesFeature] });
      if (route.kind === "part") {
        blobs.set(route.blobId, new Uint8Array(await request.arrayBuffer()));
        return new Response(null);
      }
      if (route.kind === "blob") return readBlob(route, request);
      if (route.kind === "live") return new Response(null, { status: 404 });
      return readDocument(route, request);
    },
  });
  return {
    server,
    blobs,
    offsets,
    held: held.promise,
    pause: () => {
      pause = true;
    },
    close: () => server.stop(true),
  };
};
