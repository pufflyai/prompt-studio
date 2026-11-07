import { expect } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  blobManifestBeginSchema,
  liveProtocolHeader,
  liveProtocolVersion,
  syncBlobReferencesFeature,
  syncRoute,
} from "pstdio-sync-contracts";
import { createPeerLive, type PeerLiveData } from "./packaged-live.fixture";
import { createPackagedDocumentStore } from "./packaged-sync-document-store.fixture";
import { createPackagedSyncIdentity, packagedAccountId } from "./packaged-sync-identity.fixture";
import { packagedProjectKey } from "./packaged-sync-project-key.fixture";

export { packagedAccountCode, packagedAccountId } from "./packaged-sync-identity.fixture";
export { packagedProjectKey } from "./packaged-sync-project-key.fixture";

/** Each account has its own private-space key; the default account keeps the established fixture key. */
export const packagedPersonalKey = (accountId: string) => ({
  generation: 1,
  secret: accountId === packagedAccountId ? "B".repeat(43) : createHash("sha256").update(accountId).digest("base64url"),
});

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

type BlobPart = Uint8Array | { path: string };
// Blobs the compiled host uploads: latest-state chunks, large saves and files. A directory keeps
// their bytes on disk, for workloads larger than memory.
const createBlobStore = (directory?: string) => {
  const blobs = new Map<string, { parts: Map<number, BlobPart>; complete: boolean; children?: string[] }>();
  const served: { deviceId: string; blobId: string }[] = [];
  let failReads: (deviceId: string) => boolean = () => false;
  const partBytes = (part: BlobPart) => ("path" in part ? readFileSync(part.path) : part);
  const bytes = (blob: { parts: Map<number, BlobPart> }) =>
    Buffer.concat([...blob.parts].sort(([a], [b]) => a - b).map(([, part]) => partBytes(part)));
  const savePart = (id: string, index: number, body: Uint8Array): BlobPart => {
    if (!directory) return body;
    const path = join(directory, `${id.replace(/[^A-Za-z0-9_-]/g, "_")}.${index}`);
    writeFileSync(path, body);
    return { path };
  };
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
  const request = async (request: Request, path: string, parts: string[], deviceId: string) => {
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
      blob!.parts.set(Number(parts[7]), savePart(id, Number(parts[7]), new Uint8Array(await request.arrayBuffer())));
      return json({ ok: true });
    }
    if (path.endsWith("/read")) {
      if (failReads(deviceId)) return Response.json({ error: "unavailable" }, { status: 503 });
      if (!blob?.complete) return new Response(null, { status: 404 });
      served.push({ deviceId, blobId: id });
      return new Response(bytes(blob));
    }
    return new Response(null, { status: 404 });
  };
  return {
    request,
    complete: (id: string) => !!blobs.get(id)?.complete,
    contents: () => [...blobs.values()].map(bytes),
    served: () => [...served],
    failReads(value: (deviceId: string) => boolean) {
      failReads = value;
    },
  };
};

// A wire-level peer for the compiled host. Real PostgreSQL/object-store behavior is checked in
// services/relay/src/transport/document-client.p1.integration.ts.
export const createPackagedSyncPeer = (
  tls: { key: Bun.BunFile; cert: Bun.BunFile } | undefined,
  hostname = "127.0.0.1",
  options: { blobDirectory?: string } = {},
) => {
  const live = createPeerLive();
  const identity = createPackagedSyncIdentity();
  // Each account sees only its own Cloud projects.
  const projects = new Map<string, Set<string>>();
  const blobs = createBlobStore(options.blobDirectory);
  const blockedDevices = new Set<string>();
  const { request: documentRequest, ...documentStore } = createPackagedDocumentStore(blobs, live.changed);
  const json = (body: unknown) => Response.json(body);
  const workbenchRequest = (path: string, accountId: string) => {
    if (path.endsWith("/keys"))
      return json({ project: [packagedProjectKey], personal: [packagedPersonalKey(accountId)] });
    let owned = projects.get(accountId);
    if (!owned) {
      owned = new Set();
      projects.set(accountId, owned);
    }
    if (path === "/v1/workbenches") return json([...owned].map((workbenchId) => ({ workbenchId })));
    const [, , , id, action] = path.split("/");
    if (action === "remove") owned.delete(decodeURIComponent(id!));
    else owned.add(decodeURIComponent(id!));
    return json({ ok: true });
  };
  const managerRequest = async (request: Request, path: string, origin: string) => {
    const managed = await identity.request(request, path, origin);
    if (managed) return managed;
    if (path === "/v1/workbenches" || path.startsWith("/v1/workbenches/")) {
      const accountId = identity.account(request);
      if (!accountId) return new Response(null, { status: 401 });
      return workbenchRequest(path, accountId);
    }

    return null;
  };
  const storedRequest = (request: Request, path: string, access: { deviceId: string; accountId: string }) => {
    if (path.endsWith("/capabilities")) return json({ protocolVersion: 1, features: [syncBlobReferencesFeature] });
    const parts = path.split("/");
    const spaceOwner = privateSpaceOwner(parts);
    // A private space is readable and writable only by its own account's devices.
    if (spaceOwner !== null && spaceOwner !== access.accountId) return new Response(null, { status: 403 });
    if (parts[4] === "blobs") return blobs.request(request, path, parts, access.deviceId);
    return documentRequest(request, path, parts, spaceOwner, access.deviceId);
  };
  const upgradeLive = (
    request: Request,
    server: Bun.Server<PeerLiveData>,
    access: { deviceId: string; projectId: string; accountId: string },
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
        return storedRequest(request, path, access);
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
    setEarlyAccess: identity.setEarlyAccess,
    blobContents: blobs.contents,
    /** Every successful blob read, in order, with the device that read it. */
    blobReads: blobs.served,
    /** While the predicate holds for a device, its blob reads fail as an outage does. */
    failBlobReads: blobs.failReads,
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
