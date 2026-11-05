import { liveProtocolHeader, liveProtocolVersion, type StateInfo, type StoredUpdate } from "pstdio-sync-contracts";

import { createDocumentPeerLive, type PeerLiveData } from "./document-peer-live.fixture";

/** Blind wire peer: production client encryption, document merging and asset transfers run unchanged. */
export const documentPeer = (
  projects: string[] = [],
  options: {
    beforeSubscribe?: (deviceId: string, topic: string) => Promise<void>;
    onRead?: (id: string) => void;
  } = {},
) => {
  const live = createDocumentPeerLive(options.beforeSubscribe);
  const documents = new Map<string, StoredUpdate[]>();
  // Latest states: the record stream founds itself with one and later compacts into new ones.
  const states = new Map<string, { info: StateInfo; payload: string }>();
  const blobs = new Map<
    string,
    { parts: Map<number, Uint8Array>; complete: boolean; sha256: string; byteLength: number; children: string[] }
  >();
  const offsets: number[] = [];
  let missing = false;
  type BlobState = NonNullable<ReturnType<typeof blobs.get>>;
  type AfterPrefix = (blob: Pick<BlobState, "sha256" | "byteLength">) => Promise<void>;
  let interrupt: AfterPrefix | undefined;
  const readBlob = async (request: Request, blob: BlobState) => {
    if (missing) return new Response(null, { status: 404 });
    const { offset } = (await request.json()) as { offset: number };
    offsets.push(offset);
    const bytes = Buffer.concat([...blob.parts].sort(([a], [b]) => a - b).map(([, bytes]) => Buffer.from(bytes)));
    if (interrupt) {
      const afterPrefix = interrupt;
      interrupt = undefined;
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.subarray(offset, Math.max(offset + 1, Math.floor(bytes.length / 2))));
            // Disconnect only after the receiver has stored a prefix; a timer can
            // discard every queued byte before a busy client begins reading.
            void afterPrefix(blob).then(
              () => controller.error(new Error("Interrupted blob")),
              (error: unknown) => controller.error(error),
            );
          },
        }),
      );
    }
    return new Response(bytes.subarray(offset));
  };
  const beginBlob = async (request: Request, path: string, id: string) => {
    const body = (await request.json()) as { sha256: string; byteLength: number; children?: string[] };
    const children = path.endsWith("/begin-manifest") ? body.children : [];
    if (
      !Array.isArray(children) ||
      children.length > 256 ||
      new Set(children).size !== children.length ||
      children.some((id) => !blobs.get(`~${id}`)?.complete)
    )
      return Response.json({ error: "invalid-children" }, { status: 400 });
    let blob = blobs.get(id);
    if (!blob) {
      blob = { ...body, children, parts: new Map(), complete: false };
      blobs.set(id, blob);
    } else if (
      blob.sha256 !== body.sha256 ||
      blob.byteLength !== body.byteLength ||
      JSON.stringify(blob.children) !== JSON.stringify(children)
    )
      return Response.json({ error: "immutable-blob" }, { status: 409 });
    return Response.json({
      partSize: 1_048_576,
      completed: blob.complete,
      parts: [...blob.parts].map(([number, bytes]) => ({
        number,
        sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
        byteLength: bytes.length,
      })),
    });
  };
  const blobRequest = async (request: Request, path: string, parts: string[]) => {
    const id = parts[5]!;
    if (path.endsWith("/begin") || path.endsWith("/begin-manifest")) return beginBlob(request, path, id);
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
  const publishChange = (id: string, spaceOwner: string | null, created: boolean) =>
    live.changed(
      {
        documentId: id.slice(1),
        spaceOwner,
        lastSequence: documents.get(id)?.length ?? 0,
        stateId: states.get(id)?.info.stateId ?? null,
      },
      created,
    );
  const stateRequest = async (request: Request, id: string, spaceOwner: string | null) => {
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
    const created = !current && !documents.get(id)?.length;
    states.set(id, { info, payload: body.payload });
    publishChange(id, spaceOwner, created);
    return Response.json({ state: info });
  };
  const documentRequest = async (request: Request, path: string, id: string, spaceOwner: string | null) => {
    const updates = documents.get(id) ?? [];
    documents.set(id, updates);
    if (path.includes("/states/")) return new Response(Buffer.from(states.get(id)!.payload, "base64"));
    if (path.endsWith("/state")) return stateRequest(request, id, spaceOwner);
    if (path.endsWith("/read")) {
      options.onRead?.(id.slice(1));
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
      const created = !updates.length && !states.has(id);
      const sequence = updates.length + 1;
      updates.push({
        updateId: update.updateId,
        payload: update.payload,
        sequence,
        deviceId: "wire-device",
        createdAt: new Date().toISOString(),
      });
      publishChange(id, spaceOwner, created);
      return Response.json({ sequence, duplicate: false });
    }
    return new Response(null, { status: 404 });
  };
  const managerRequest = (path: string) => {
    if (path.endsWith("/capabilities")) return Response.json({ protocolVersion: 1, features: ["blob-references-v1"] });
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
    return null;
  };
  const server = Bun.serve<PeerLiveData>({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request, server) {
      const path = new URL(request.url).pathname;
      const managed = managerRequest(path);
      if (managed) return managed;
      if (path.endsWith("/live")) {
        if (request.headers.get(liveProtocolHeader) !== String(liveProtocolVersion))
          return Response.json(
            { error: "protocol-unsupported", supported: [liveProtocolVersion], message: "Update Prompt Studio" },
            { status: 426 },
          );
        if (
          server.upgrade(request, {
            data: {
              discovery: new Set(),
              topics: new Set(),
              deviceId: request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "wire-device",
            },
          })
        )
          return;
        return new Response(null, { status: 426 });
      }
      const parts = path.split("/");
      const spaceOwner = parts[4] === "spaces" ? decodeURIComponent(parts[5]!.slice(1)) : null;
      if (parts[4] === "spaces") parts.splice(4, 2);
      const id = parts[5]!;
      if (parts[4] === "blobs") return blobRequest(request, path, parts);
      return documentRequest(request, path, id, spaceOwner);
    },
    websocket: live.handlers,
  });
  return {
    origin: server.url.origin,
    subscriptions: live.subscriptions,
    documents,
    states,
    blobs,
    offsets,
    interrupt: (afterPrefix: AfterPrefix) => {
      interrupt = afterPrefix;
    },
    missing: (value: boolean) => {
      missing = value;
    },
    close: () => server.stop(true),
  };
};
