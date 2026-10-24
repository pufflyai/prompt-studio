import type { StateInfo, StoredUpdate } from "pstdio-sync-contracts";

/** Blind wire peer: production client encryption, document merging and asset transfers run unchanged. */
export const documentPeer = (projects: string[] = []) => {
  const documents = new Map<string, StoredUpdate[]>();
  // Latest states: the record stream founds itself with one and later compacts into new ones.
  const states = new Map<string, { info: StateInfo; payload: string }>();
  const blobs = new Map<
    string,
    { parts: Map<number, Uint8Array>; complete: boolean; sha256: string; byteLength: number }
  >();
  const offsets: number[] = [];
  let interrupt = false;
  let missing = false;
  type BlobState = NonNullable<ReturnType<typeof blobs.get>>;
  const readBlob = async (request: Request, blob: BlobState) => {
    if (missing) return new Response(null, { status: 404 });
    const { offset } = (await request.json()) as { offset: number };
    offsets.push(offset);
    const bytes = Buffer.concat([...blob.parts].sort(([a], [b]) => a - b).map(([, bytes]) => Buffer.from(bytes)));
    if (interrupt) {
      interrupt = false;
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.subarray(offset, Math.max(offset + 1, Math.floor(bytes.length / 2))));
            setTimeout(() => controller.error(new Error("Interrupted blob")), 25);
          },
        }),
      );
    }
    return new Response(bytes.subarray(offset));
  };
  const blobRequest = async (request: Request, path: string, parts: string[]) => {
    const id = parts[5]!;
    if (path.endsWith("/begin")) {
      const body = (await request.json()) as { sha256: string; byteLength: number };
      let blob = blobs.get(id);
      if (!blob) {
        blob = { ...body, parts: new Map(), complete: false };
        blobs.set(id, blob);
      }
      return Response.json({
        partSize: 1_048_576,
        completed: blob.complete,
        parts: [...blob.parts].map(([number, bytes]) => ({
          number,
          sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
          byteLength: bytes.length,
        })),
      });
    }
    const blob = blobs.get(id);
    if (!blob) return new Response(null, { status: 404 });
    if (parts[6] === "parts") {
      blob.parts.set(Number(parts[7]), new Uint8Array(await request.arrayBuffer()));
      return Response.json({ ok: true });
    }
    if (path.endsWith("/finish")) {
      blob.complete = true;
      return Response.json({ ok: true });
    }
    if (path.endsWith("/read")) return readBlob(request, blob);
    return new Response(null, { status: 404 });
  };
  const publishChange = (id: string) =>
    server.publish(
      "changed",
      JSON.stringify({
        type: "changed",
        documentId: id.slice(1),
        spaceOwner: null,
        lastSequence: documents.get(id)?.length ?? 0,
        stateId: states.get(id)?.info.stateId ?? null,
      }),
    );
  const stateRequest = async (request: Request, id: string) => {
    const body = (await request.json()) as Omit<StateInfo, "byteLength" | "deviceId" | "createdAt"> & {
      payload: string;
    };
    const current = states.get(id)?.info ?? null;
    // Like the relay, accept one founding state and later states only on the current base.
    if ((current?.stateId ?? null) !== body.baseStateId)
      return Response.json({ error: "stale-state", state: current }, { status: 409 });
    const info: StateInfo = {
      stateId: body.stateId,
      baseStateId: body.baseStateId,
      through: body.through,
      summary: body.summary,
      byteLength: Buffer.from(body.payload, "base64").length,
      deviceId: "wire-device",
      createdAt: new Date().toISOString(),
    };
    states.set(id, { info, payload: body.payload });
    publishChange(id);
    return Response.json({ state: info });
  };
  const documentRequest = async (request: Request, path: string, id: string) => {
    const updates = documents.get(id) ?? [];
    documents.set(id, updates);
    if (path.includes("/states/")) return new Response(Buffer.from(states.get(id)!.payload, "base64"));
    if (path.endsWith("/state")) return stateRequest(request, id);
    if (path.endsWith("/read")) {
      const { after } = (await request.json()) as { after: number };
      return Response.json({
        status: "updates",
        state: states.get(id)?.info ?? null,
        lastSequence: updates.length,
        updates: updates.filter((update) => update.sequence > after),
        more: false,
      });
    }
    if (path.endsWith("/updates")) {
      const update = (await request.json()) as StoredUpdate;
      const previous = updates.find((item) => item.updateId === update.updateId);
      if (previous) return Response.json({ sequence: previous.sequence, duplicate: true });
      const sequence = updates.length + 1;
      updates.push({
        updateId: update.updateId,
        payload: update.payload,
        sequence,
        deviceId: "wire-device",
        createdAt: new Date().toISOString(),
      });
      publishChange(id);
      return Response.json({ sequence, duplicate: false });
    }
    return new Response(null, { status: 404 });
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request, server) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account") return Response.json({ features: { relay: true } });
      if (path === "/v1/workbenches") return Response.json(projects.map((workbenchId) => ({ workbenchId })));
      if (path === "/v1/environment-access")
        return Response.json({ token: "wire-access", expiresAt: new Date(Date.now() + 60_000).toISOString() });
      if (path === "/v1/devices/presence") return Response.json({ ok: true });
      if (path.endsWith("/keys"))
        return Response.json({
          project: [{ generation: 1, secret: "A".repeat(43) }],
          personal: [{ generation: 1, secret: "B".repeat(43) }],
        });
      if (path.endsWith("/live")) {
        if (server.upgrade(request)) return;
        return new Response(null, { status: 426 });
      }
      const parts = path.split("/");
      if (parts[4] === "spaces") parts.splice(4, 2);
      const id = parts[5]!;
      if (parts[4] === "blobs") return blobRequest(request, path, parts);
      return documentRequest(request, path, id);
    },
    websocket: {
      open(socket) {
        socket.subscribe("changed");
        socket.send(JSON.stringify({ type: "ready", protocolVersion: 1 }));
      },
      message() {},
    },
  });
  return {
    origin: server.url.origin,
    documents,
    states,
    blobs,
    offsets,
    interrupt: () => {
      interrupt = true;
    },
    missing: (value: boolean) => {
      missing = value;
    },
    close: () => server.stop(true),
  };
};
