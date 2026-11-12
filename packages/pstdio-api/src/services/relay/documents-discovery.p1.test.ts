import { expect, test } from "bun:test";
import { createDocumentRelayConnection } from "pstdio-sync/relay";
import {
  liveClientMessageSchema,
  liveProtocolVersion,
  syncBlobReferencesFeature,
  syncRoute,
} from "pstdio-sync-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { createExtensionDocumentSync } from "./documents";
import { numberRelayFixture } from "./resource-number-sync.fixture";

const readDocument = async (relay: ReturnType<typeof numberRelayFixture>, id: string, after: number) => {
  const result = await relay.relay(id).read(after);
  if (result.status !== "updates") return result;
  const state = result.state;
  return {
    ...result,
    state: state
      ? {
          stateId: state.stateId,
          baseStateId: state.baseStateId,
          through: state.through,
          byteLength: state.byteLength,
          summary: state.summary,
          deviceId: state.deviceId,
          createdAt: state.createdAt,
        }
      : null,
    updates: result.updates.map(({ sequence, updateId, payload, deviceId, createdAt }) => ({
      sequence,
      updateId,
      payload,
      deviceId,
      createdAt,
    })),
  };
};

const documentResponse = async (request: Request, relay: ReturnType<typeof numberRelayFixture>) => {
  const route = syncRoute(new URL(request.url).pathname);
  if (!route || !("documentId" in route)) return new Response(null, { status: 404 });
  const target = relay.relay(route.documentId);
  if (route.kind === "state") return new Response(new Uint8Array(await target.state({} as never)));
  if (route.kind !== "document") return new Response(null, { status: 404 });
  const body = await request.json();
  if (route.operation === "read") return Response.json(await readDocument(relay, route.documentId, body.after));
  if (route.operation === "updates") return Response.json(await target.update(body));
  if (!(await target.replace(body))) return Response.json({ error: "stale-state", state: null }, { status: 409 });
  return Response.json({ state: (await readDocument(relay, route.documentId, 0)).state });
};

for (const order of ["full only", "targeted first", "full first", "targeted only"] as const)
  test(`a cold download with ${order} finishes in one owner sweep`, async () => {
    const app = await createTestApp();
    const controller = new AbortController();
    const keyRequested = Promise.withResolvers<void>();
    const releaseKeys = Promise.withResolvers<void>();
    const fullEntered = Promise.withResolvers<void>();
    const targetedIssued = Promise.withResolvers<void>();
    let keyRequests = 0;
    let keysReleased = false;
    const relay = numberRelayFixture();
    const peer = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request, server) {
        if (request.headers.get("upgrade") === "websocket") {
          if (server.upgrade(request)) return;
          return new Response(null, { status: 426 });
        }
        const path = new URL(request.url).pathname;
        if (path.endsWith("/capabilities"))
          return Response.json({ protocolVersion: 1, features: [syncBlobReferencesFeature] });
        if (path.endsWith("/keys")) {
          keyRequests++;
          keyRequested.resolve();
          await releaseKeys.promise;
          return Response.json({
            project: [{ generation: 1, secret: "A".repeat(43) }],
            personal: [{ generation: 1, secret: "B".repeat(43) }],
          });
        }
        return documentResponse(request, relay);
      },
      websocket: {
        open(socket) {
          socket.send(JSON.stringify({ type: "ready", protocolVersion: liveProtocolVersion }));
        },
        message(socket, data) {
          const frame = liveClientMessageSchema.parse(JSON.parse(String(data)));
          if ("requestId" in frame)
            socket.send(JSON.stringify({ type: "control-result", requestId: frame.requestId, retryAfterMs: 0 }));
        },
      },
    });
    const project = await app.deps.projectService.create({ name: "Cold discovery" });
    const owner = { workbenchId: project.id, extensionId: "example.notes" };
    await app.deps.extensionStorageService.openNativeTextDocument({ owner, fileId: "open" }).seed("Open editor");
    const access = async () => ({ token: "access", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const sync = createExtensionDocumentSync({
      owner,
      deps: app.deps,
      config: {
        accountId: "owner",
        workbenchId: project.id,
        environmentId: "device",
        managerOrigin: peer.url.origin,
        relayOrigin: peer.url.origin,
        renewalGrant: "credential",
      },
      access,
      discoveryNeeded: () => connection.wake(),
    });
    let sweeps = 0;
    let drains = 0;
    const document = JSON.stringify(["native-markdown", "open"]);
    const settled = Promise.withResolvers<void>();
    const connection = createDocumentRelayConnection({
      origin: peer.url.origin,
      projectId: project.id,
      access,
      signal: controller.signal,
      onReady: () => {
        if (order === "targeted first") connection.wakeDocument(document);
      },
      synchronizeDocument: async (name, signal) => {
        const work = sync.synchronizeDocument(name, signal);
        await Promise.resolve();
        targetedIssued.resolve();
        return work;
      },
      synchronize: async (signal) => {
        if (++drains === 1 && order === "targeted only") {
          const targeted = sync.synchronizeDocument(document, signal);
          fullEntered.resolve();
          await targeted;
          return;
        }
        sweeps++;
        // The extension owner prepares keys before projecting files, then downloads.
        const preparing = sync.prepare(signal);
        fullEntered.resolve();
        await preparing;
        await sync.synchronize(signal);
      },
      onError: (error) => settled.reject(error),
      onStatusChange: () => {
        if (drains && !connection.status().busy) settled.resolve();
      },
    });
    try {
      await fullEntered.promise;
      await keyRequested.promise;
      if (order === "full first") connection.wakeDocument(document);
      if (order === "full first" || order === "targeted first") await targetedIssued.promise;
      expect(keysReleased).toBe(false);
      expect(keyRequests).toBe(1);
      keysReleased = true;
      releaseKeys.resolve();
      await settled.promise;
      expect(await sync.status()).toMatchObject({ firstDownloaded: true, downloaded: true, pendingItems: 0 });
      expect(sweeps).toBe(1);
    } finally {
      releaseKeys.resolve();
      controller.abort();
      await connection.done;
      await sync.close();
      await peer.stop(true);
      await app.close();
    }
  });
