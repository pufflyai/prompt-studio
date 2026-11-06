import { expect } from "bun:test";
import {
  blobManifestBeginSchema,
  liveProtocolHeader,
  liveProtocolVersion,
  syncBlobReferencesFeature,
  syncRoute,
} from "pstdio-sync-contracts";
import { createPeerLive, type PeerLiveData } from "./packaged-live.fixture";
import { createPackagedDocumentStore } from "./packaged-sync-document-store.fixture";
import { createPackagedSyncIdentity } from "./packaged-sync-identity.fixture";
import { packagedProjectKey } from "./packaged-sync-project-key.fixture";

export { packagedProjectKey } from "./packaged-sync-project-key.fixture";

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
  const blobs = new Map<string, { parts: Map<number, Uint8Array>; complete: boolean; children?: string[] }>();
  const bytes = (blob: { parts: Map<number, Uint8Array> }) =>
    Buffer.concat([...blob.parts].sort(([a], [b]) => a - b).map(([, part]) => part));
  const json = (body: unknown) => Response.json(body);
  const beginManifest = async (request: Request, id: string) => {
    const input = blobManifestBeginSchema.safeParse(await request.json());
    if (!input.success || input.data.children.some((child) => !blobs.get(`~${child}`)?.complete))
      return Response.json({ error: "invalid-request" }, { status: 400 });
    const previous = blobs.get(id);
    if (previous && JSON.stringify(previous.children) !== JSON.stringify(input.data.children))
      return Response.json({ error: "invalid-request" }, { status: 400 });
    const blob = previous ?? { parts: new Map(), complete: false, children: input.data.children };
    blobs.set(id, blob);
    return json({ partSize: 1_048_576, completed: blob.complete, parts: [] });
  };
  const request = async (request: Request, path: string, parts: string[]) => {
    const id = parts[5]!;
    let blob = blobs.get(id);
    if (path.endsWith("/begin-manifest")) return beginManifest(request, id);
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
  const live = createPeerLive();
  const identity = createPackagedSyncIdentity();
  const projects = new Set<string>();
  const blobs = createBlobStore();
  const blockedDevices = new Set<string>();
  const { request: documentRequest, ...documentStore } = createPackagedDocumentStore(blobs, live.changed);
  const json = (body: unknown) => Response.json(body);
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
    const managed = await identity.request(request, path, origin);
    if (managed) return managed;
    if (path === "/v1/workbenches" || path.startsWith("/v1/workbenches/")) return workbenchRequest(path);

    return null;
  };
  const storedRequest = (request: Request, path: string, deviceId: string) => {
    if (path.endsWith("/capabilities")) return json({ protocolVersion: 1, features: [syncBlobReferencesFeature] });
    const parts = path.split("/");
    const spaceOwner = privateSpaceOwner(parts);
    if (spaceOwner !== null && spaceOwner !== "owner") return new Response(null, { status: 403 });
    if (parts[4] === "blobs") return blobs.request(request, path, parts);
    return documentRequest(request, path, parts, spaceOwner, deviceId);
  };
  const upgradeLive = (
    request: Request,
    server: Bun.Server<PeerLiveData>,
    access: { deviceId: string; projectId: string },
  ) => {
    expect(request.headers.get(liveProtocolHeader)).toBe(String(liveProtocolVersion));
    if (server.upgrade(request, { data: { ...access, discovery: new Set() } })) return;
    return new Response(null, { status: 426 });
  };
  // Private project data lives under /spaces/~<owner>; the rest of the path matches project documents.
  const serve = (port: number) =>
    Bun.serve<PeerLiveData>({
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
        if (blockedDevices.has(access.deviceId)) return Response.json({ error: "unavailable" }, { status: 503 });
        if (route.kind === "live") {
          return upgradeLive(request, server, access);
        }
        return storedRequest(request, path, access.deviceId);
      },
      websocket: live.handlers,
    });
  let server = serve(0);
  const port = server.port;
  return {
    get origin() {
      return server.url.origin;
    },
    ...documentStore,
    blobContents: blobs.contents,
    /** One device loses durable relay access while its peers can continue replacing latest states. */
    blockDevice(deviceId: string, blocked: boolean) {
      if (blocked) blockedDevices.add(deviceId);
      else blockedDevices.delete(deviceId);
    },
    /** Drops every connection, as a lost network does. */
    stop: () => server.stop(true),
    /** Serves again on the same address with the stored data. */
    restart() {
      server = serve(port!);
    },
  };
};
