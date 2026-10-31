import { expect } from "bun:test";
import { liveClientMessageSchema, syncRoute } from "pstdio-sync-contracts";
import { createPackagedSyncIdentity } from "./packaged-sync-identity.fixture";
import { packagedProjectKey } from "./packaged-sync-project-key.fixture";

export { packagedProjectKey } from "./packaged-sync-project-key.fixture";

const forwardLive = (socket: Bun.ServerWebSocket<{ deviceId: string; projectId: string }>, data: string | Buffer) => {
  try {
    if (typeof data !== "string") return socket.close(1008);
    const parsed = liveClientMessageSchema.safeParse(JSON.parse(data));
    if (!parsed.success || (parsed.data.spaceOwner !== null && parsed.data.spaceOwner !== "owner"))
      return socket.close(1008);
    // Live bytes travel only to the other connections in this project, never through document storage.
    socket.publish(`live:${socket.data.projectId}`, JSON.stringify({ ...parsed.data, deviceId: socket.data.deviceId }));
  } catch {
    socket.close(1008);
  }
};

const validateLeafBegin = async (request: Request) => {
  const input = (await request.json()) as { sha256: string; byteLength: number };
  expect(Object.keys(input).sort()).toEqual(["byteLength", "sha256"]);
  expect(input.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(input.byteLength).toBeGreaterThan(0);
};

const privateSpaceOwner = (parts: string[]) => {
  if (parts[4] !== "spaces") return null;
  const owner = decodeURIComponent(parts[5]!.slice(1));
  parts.splice(4, 2);
  return owner;
};

// Blobs the compiled host uploads: latest-state chunks, large saves and files.
const createBlobStore = () => {
  const blobs = new Map<string, { parts: Map<number, Uint8Array>; complete: boolean }>();
  const bytes = (blob: { parts: Map<number, Uint8Array> }) =>
    Buffer.concat([...blob.parts].sort(([a], [b]) => a - b).map(([, part]) => part));
  const json = (body: unknown) => Response.json(body);
  const request = async (request: Request, path: string, parts: string[]) => {
    const id = parts[5]!;
    let blob = blobs.get(id);
    if (path.endsWith("/begin")) {
      await validateLeafBegin(request);
      blob ??= { parts: new Map(), complete: false };
      blobs.set(id, blob);
      return json({ partSize: 1_048_576, completed: blob.complete, parts: [] });
    }
    if (path.endsWith("/finish")) {
      blob!.complete = true;
      return json({ ok: true });
    }
    if (parts[6] === "parts") {
      blob!.parts.set(Number(parts[7]), new Uint8Array(await request.arrayBuffer()));
      return json({ ok: true });
    }
    if (path.endsWith("/read")) {
      if (!blob?.complete) return new Response(null, { status: 404 });
      return new Response(bytes(blob));
    }
    return new Response(null, { status: 404 });
  };
  return {
    request,
    complete: (id: string) => !!blobs.get(id)?.complete,
    contents: () => [...blobs.values()].map(bytes),
  };
};

// A wire-level peer for the compiled host. Real PostgreSQL/object-store behavior is checked in
// services/relay/src/transport/document-client.p1.integration.ts.
export const createPackagedSyncPeer = (
  tls: { key: Bun.BunFile; cert: Bun.BunFile } | undefined,
  hostname = "127.0.0.1",
) => {
  const projects = new Set<string>();
  const blobs = createBlobStore();
  const documents = new Map<
    string,
    { state: Record<string, unknown> | null; payload?: string; updates: Record<string, unknown>[] }
  >();
  const identity = createPackagedSyncIdentity();
  let storedStates = 0;
  const personalDocumentIds = new Set<string>();
  // While set, document reads fail, so a device cannot finish its first download. A function picks the
  // documents whose reads fail.
  let failReads: boolean | ((documentId: string) => boolean) = false;
  let failedReads = 0;
  let completedReads = 0;
  const document = (id: string) => {
    let value = documents.get(id);
    if (!value) {
      value = { state: null, updates: [] };
      documents.set(id, value);
    }
    return value;
  };
  const json = (body: unknown) => Response.json(body);
  // Like the relay, tell connected devices that a document changed so they read it again.
  const publishChange = (documentId: string, spaceOwner: string | null) => {
    const doc = document(documentId);
    server.publish(
      "changed",
      JSON.stringify({
        type: "changed",
        spaceOwner,
        documentId: documentId.slice(1),
        lastSequence: doc.updates.length,
        stateId: doc.state?.stateId ?? null,
      }),
    );
  };
  const workbenchRequest = (path: string) => {
    if (path.endsWith("/keys"))
      return json({
        project: [packagedProjectKey],
        personal: [{ generation: 1, secret: "B".repeat(43) }],
      });
    if (path === "/v1/workbenches") return json([...projects].map((workbenchId) => ({ workbenchId })));
    const [, , , id, action] = path.split("/");
    if (action === "remove") projects.delete(decodeURIComponent(id!));
    else projects.add(decodeURIComponent(id!));
    return json({ ok: true });
  };
  const managerRequest = async (request: Request, path: string, origin: string) => {
    const response = await identity.request(request, path, origin);
    if (response) return response;
    if (path === "/v1/workbenches" || path.startsWith("/v1/workbenches/")) return workbenchRequest(path);
    return null;
  };
  const documentRequest = async (
    request: Request,
    path: string,
    parts: string[],
    spaceOwner: string | null,
    deviceId: string,
  ) => {
    const id = parts[5]!;
    if (spaceOwner) personalDocumentIds.add(id);
    const input = async () => (await request.json()) as Record<string, unknown>;
    const doc = document(id);
    if (path.endsWith("/read")) {
      if (typeof failReads === "function" ? failReads(id.slice(1)) : failReads) {
        failedReads++;
        return new Response(null, { status: 503 });
      }
      const { after } = await input();
      completedReads++;
      return json({
        status: "updates",
        state: doc.state,
        lastSequence: doc.updates.length,
        more: false,
        updates: doc.updates.filter((update) => Number(update.sequence) > Number(after)),
      });
    }
    if (parts[6] === "states") return new Response(Buffer.from(String(doc.payload), "base64"));
    const body = await input();
    for (const blobId of body.blobIds as string[]) expect(blobs.complete(`~${blobId}`)).toBe(true);
    expect(String(body.payload)).not.toContain("packaged-secret");
    if (path.endsWith("/updates")) {
      const sequence = doc.updates.length + 1;
      doc.updates.push({
        updateId: body.updateId,
        payload: body.payload,
        sequence,
        deviceId,
        createdAt: new Date().toISOString(),
      });
      publishChange(id, spaceOwner);
      return json({ sequence, duplicate: false });
    }
    expect(body.summary).toBeString();
    storedStates++;
    doc.payload = String(body.payload);
    doc.state = {
      stateId: body.stateId,
      baseStateId: body.baseStateId,
      through: body.through,
      summary: body.summary,
      byteLength: Buffer.from(String(body.payload), "base64").length,
      deviceId,
      createdAt: new Date().toISOString(),
    };
    publishChange(id, spaceOwner);
    return json({ state: doc.state });
  };
  const storedRequest = (request: Request, path: string, deviceId: string) => {
    const parts = path.split("/");
    const spaceOwner = privateSpaceOwner(parts);
    if (spaceOwner !== null && spaceOwner !== "owner") return new Response(null, { status: 403 });
    if (parts[4] === "blobs") return blobs.request(request, path, parts);
    return documentRequest(request, path, parts, spaceOwner, deviceId);
  };
  // Private project data lives under /spaces/~<owner>; the rest of the path matches project documents.
  const serve = (port: number) =>
    Bun.serve<{ deviceId: string; projectId: string }>({
      hostname,
      port,
      tls,
      async fetch(request, server) {
        const path = new URL(request.url).pathname;
        const managed = await managerRequest(request, path, new URL(request.url).origin);
        if (managed) return managed;
        if (!path.startsWith("/sync/")) return new Response(null, { status: 404 });
        expect(request.headers.get("pstdio-sync-protocol")).toBe("1");
        const route = syncRoute(path);
        if (!route) return new Response(null, { status: 404 });
        const access = identity.access(request, route.projectId);
        if (!access) return new Response(null, { status: 403 });
        if (route.kind === "live") {
          if (server.upgrade(request, { data: access })) return;
          return new Response(null, { status: 426 });
        }
        return storedRequest(request, path, access.deviceId);
      },
      websocket: {
        open(socket) {
          socket.subscribe("changed");
          socket.subscribe(`live:${socket.data.projectId}`);
          socket.send(JSON.stringify({ type: "ready", protocolVersion: 1 }));
        },
        message: forwardLive,
      },
    });
  let server = serve(0);
  const port = server.port;
  return {
    get origin() {
      return server.url.origin;
    },
    documents,
    blobContents: blobs.contents,
    states: () => storedStates,
    reads: () => completedReads,
    announceUnchanged() {
      for (const id of documents.keys()) publishChange(id, personalDocumentIds.has(id) ? "owner" : null);
    },
    failedReads: () => failedReads,
    personalDocuments: () => [...personalDocumentIds].map((id) => documents.get(id)!),
    failReads(value: boolean | ((documentId: string) => boolean)) {
      failReads = value;
    },
    /** Drops every connection, as a lost network does. */
    stop: () => server.stop(true),
    /** Serves again on the same address with the stored data. */
    restart() {
      server = serve(port!);
    },
    corrupt() {
      for (const [documentId, doc] of documents) {
        doc.updates.push({
          updateId: "invalidciphertext000000",
          payload: "AAAA",
          sequence: doc.updates.length + 1,
          deviceId: "invalid-fixture-device",
          createdAt: new Date().toISOString(),
        });
        publishChange(documentId, null);
      }
    },
  };
};
