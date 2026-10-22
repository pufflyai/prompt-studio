import { expect } from "bun:test";

// A wire-level peer for the compiled host. Real PostgreSQL/object-store behavior is checked in
// services/relay/src/transport/document-client.integration.ts.
export const createPackagedSyncPeer = (tls: { key: Bun.BunFile; cert: Bun.BunFile }) => {
  const projects = new Set<string>();
  const blobs = new Map<string, { parts: Set<number>; complete: boolean }>();
  const documents = new Map<
    string,
    { state: Record<string, unknown> | null; payload?: string; updates: Record<string, unknown>[] }
  >();
  let deviceId = "";
  let storedStates = 0;
  const personalDocumentIds = new Set<string>();
  const devices = new Map<string, string>();
  // While set, document reads fail, so a device cannot finish its first download.
  let failReads = false;
  let failedReads = 0;
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
        project: [{ generation: 1, secret: "A".repeat(43) }],
        personal: [{ generation: 1, secret: "B".repeat(43) }],
      });
    if (path === "/v1/workbenches") return json([...projects].map((workbenchId) => ({ workbenchId })));
    const [, , , id, action] = path.split("/");
    if (action === "remove") projects.delete(decodeURIComponent(id!));
    else projects.add(decodeURIComponent(id!));
    return json({ ok: true });
  };
  const managerRequest = async (request: Request, path: string, origin: string) => {
    const input = async () => (await request.json()) as Record<string, unknown>;
    if (path === "/api/auth/one-time-token/verify")
      return json({
        session: { token: "session", expiresAt: new Date(Date.now() + 60_000) },
        user: { id: "owner", email: "owner@example.test" },
      });
    if (path === "/v1/device-login") {
      const profile = await input();
      deviceId = String(profile.deviceId);
      devices.set(deviceId, String(profile.name));
      return json({ accountId: "owner", deviceId, token: "device-credential", relayOrigin: origin });
    }
    if (path === "/v1/devices")
      return json({
        deviceId,
        devices: [...devices].map(([id, name]) => ({
          id,
          name,
          platform: "fixture",
          createdAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          online: true,
        })),
      });
    if (path === "/api/auth/sign-out") return json({ ok: true });
    if (path === "/v1/environment-access")
      return json({ token: "relay-access", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    if (path === "/v1/account") return json({ features: { relay: true } });
    if (path === "/v1/workbenches" || path.startsWith("/v1/workbenches/")) return workbenchRequest(path);

    return null;
  };
  const blobRequest = async (request: Request, path: string, parts: string[]) => {
    const id = parts[5]!;
    let blob = blobs.get(id);
    if (path.endsWith("/begin")) {
      blob ??= { parts: new Set(), complete: false };
      blobs.set(id, blob);
      return json({ partSize: 1_048_576, completed: blob.complete, parts: [] });
    }
    if (path.endsWith("/finish")) {
      blob!.complete = true;
      return json({ ok: true });
    }
    if (parts[6] === "parts") {
      await request.arrayBuffer();
      blob!.parts.add(Number(parts[7]));
      return json({ ok: true });
    }
    return new Response(null, { status: 404 });
  };
  const documentRequest = async (request: Request, path: string, parts: string[], spaceOwner: string | null) => {
    const id = parts[5]!;
    if (spaceOwner) personalDocumentIds.add(id);
    const input = async () => (await request.json()) as Record<string, unknown>;
    const doc = document(id);
    if (path.endsWith("/read")) {
      if (failReads) {
        failedReads++;
        return new Response(null, { status: 503 });
      }
      const { after } = await input();
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
    for (const blobId of body.blobIds as string[]) expect(blobs.get(`~${blobId}`)?.complete).toBe(true);
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
  // Private project data lives under /spaces/~<owner>; the rest of the path matches project documents.
  const privateSpaceOwner = (parts: string[]) => {
    if (parts[4] !== "spaces") return null;
    const owner = decodeURIComponent(parts[5]!.slice(1));
    parts.splice(4, 2);
    return owner;
  };
  const serve = (port: number) =>
    Bun.serve({
      hostname: "127.0.0.1",
      port,
      tls,
      async fetch(request, server) {
        const path = new URL(request.url).pathname;
        const managed = await managerRequest(request, path, server.url.origin);
        if (managed) return managed;
        if (!path.startsWith("/sync/")) return new Response(null, { status: 404 });
        expect(request.headers.get("pstdio-sync-protocol")).toBe("1");
        expect(request.headers.get("authorization")).toBe("Bearer relay-access");
        if (path.endsWith("/live")) {
          if (server.upgrade(request)) return;
          return new Response(null, { status: 426 });
        }
        const parts = path.split("/");
        const spaceOwner = privateSpaceOwner(parts);
        if (spaceOwner !== null && spaceOwner !== "owner") return new Response(null, { status: 403 });
        if (parts[4] === "blobs") return blobRequest(request, path, parts);
        return documentRequest(request, path, parts, spaceOwner);
      },
      websocket: {
        open(socket) {
          socket.subscribe("changed");
          socket.send(JSON.stringify({ type: "ready", protocolVersion: 1 }));
        },
        message() {},
      },
    });
  let server = serve(0);
  const port = server.port;
  return {
    get origin() {
      return server.url.origin;
    },
    documents,
    states: () => storedStates,
    failedReads: () => failedReads,
    personalDocuments: () => [...personalDocumentIds].map((id) => documents.get(id)!),
    failReads(value: boolean) {
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
          deviceId,
          createdAt: new Date().toISOString(),
        });
        publishChange(documentId, null);
      }
    },
  };
};
