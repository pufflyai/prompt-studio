import { expect, test } from "bun:test";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { createSyncSpace } from "pstdio-sync/encryption";
import { syncRoute } from "pstdio-sync-contracts";
import { createWorkspaceContextFixture } from "../../features/extensions/workspace-context.test-fixture";
import { createExtensionDocumentSync } from "./documents";
import { numberRelayFixture } from "./resource-number-sync.fixture";

const observeDocuments = (
  storage: ReturnType<typeof createExtensionStorageDBService>,
  loads: string[],
  beforeRead: (id: string) => Promise<void>,
) => ({
  ...storage.documents,
  list: async (owner: Parameters<typeof storage.documents.list>[0]) => {
    loads.push("directory");
    return storage.documents.list(owner);
  },
  open: (id: string) => {
    const store = storage.documents.open(id);
    return {
      ...store,
      transaction: (async (...args: Parameters<typeof store.transaction>) => {
        loads.push(id);
        await beforeRead(id);
        return store.transaction(...args);
      }) as typeof store.transaction,
    };
  },
  recordStream: (owner: Parameters<typeof storage.documents.recordStream>[0]) => {
    const store = storage.documents.recordStream(owner);
    return {
      ...store,
      open: async () => {
        loads.push("record-stream");
        return store.open();
      },
    };
  },
});

const read = async (relay: ReturnType<typeof numberRelayFixture>, documentId: string, after: number) => {
  const result = await relay.relay(documentId).read(after);
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
    updates: result.updates.map((update) => ({
      sequence: update.sequence,
      updateId: update.updateId,
      payload: update.payload,
      deviceId: update.deviceId,
      createdAt: update.createdAt,
    })),
  };
};

for (const { heldSource, cold } of [
  { heldSource: "owner", cold: false },
  { heldSource: "unrelated", cold: false },
  { heldSource: "owner", cold: true },
])
  test(`${cold ? "cold" : "warm"} text and status stay independent of held ${heldSource} work on both hosts`, async () => {
    const context = await createWorkspaceContextFixture();
    const databases = await Promise.all([createDb({ path: ":memory:" }), createDb({ path: ":memory:" })]);
    const owner = { workbenchId: "project", extensionId: "example.notes" };
    const keys = [
      { generation: 1, secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url") },
    ];
    const space = await createSyncSpace({ projectId: owner.workbenchId, spaceOwner: null, keys });
    const name = JSON.stringify(["native-markdown", "known"]);
    const documentId = await space.documentId(JSON.stringify([owner.extensionId, name]));
    const ownerId = await space.documentId(JSON.stringify([owner.extensionId, "owner"]));
    const streamId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
    const heldId =
      heldSource === "owner"
        ? ownerId
        : await space.documentId(JSON.stringify([owner.extensionId, JSON.stringify(["native-markdown", "unrelated"])]));
    const relay = numberRelayFixture();
    const release = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const controller = new AbortController();
    let held = false;
    let heldReads = 0;
    const rotationEntered = Promise.withResolvers<void>();
    const rotationRelease = Promise.withResolvers<void>();
    let pauseText = false;
    let holdStatus = false;
    const statusEntered = Promise.withResolvers<void>();
    const resumeStatus = Promise.withResolvers<void>();
    const retirementEntered = Promise.withResolvers<void>();
    const retirementRelease = Promise.withResolvers<void>();
    let retirementId: string | undefined;
    let retiringBackground: Promise<unknown> | undefined;
    const readDocument = async (id: string, after: number) => {
      if (retirementId === id) {
        retirementId = undefined;
        retirementEntered.resolve();
        await retirementRelease.promise;
      }
      if (pauseText && id === documentId) {
        pauseText = false;
        rotationEntered.resolve();
        await rotationRelease.promise;
      }
      if (held && id === heldId) {
        if (++heldReads === 2) entered.resolve();
        await release.promise;
      }
      return Response.json(await read(relay, id, after));
    };
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname.endsWith("/keys")) return Response.json({ project: keys, personal: keys });
        const route = syncRoute(url.pathname);
        if (!route || !("documentId" in route)) return new Response(null, { status: 404 });
        const target = relay.relay(route.documentId);
        if (route.kind === "state") return new Response(new Uint8Array(await target.state({} as never)));
        if (route.kind !== "document") return new Response(null, { status: 404 });
        const body = await request.json();
        if (route.operation === "read") {
          return readDocument(route.documentId, body.after);
        }
        if (route.operation === "updates") return Response.json(await target.update(body));
        if (!(await target.replace(body))) return Response.json({ error: "stale-state", state: null }, { status: 409 });
        const state = await read(relay, route.documentId, 0);
        return Response.json({ state: state.state });
      },
    });
    const loads: string[][] = [[], []];
    const syncs: ReturnType<typeof createExtensionDocumentSync>[] = [];
    const background: Promise<void>[] = [];
    try {
      for (const [index, database] of databases.entries()) {
        const now = new Date().toISOString();
        await database.db
          .insert(projects)
          .values({ id: owner.workbenchId, name: "Project", shorthand: "project", created_at: now, updated_at: now });
        const storage = createExtensionStorageDBService(database.db);
        await storage.openNativeTextDocument({ owner, fileId: "known" }).seed("seed");
        await storage.openNativeTextDocument({ owner, fileId: "unrelated" }).seed("other");
        const deps = {
          ...context.deps,
          extensionStorageService: {
            ...storage,
            documents: observeDocuments(storage, loads[index]!, async (id) => {
              if (index === 1 && id === name && holdStatus) {
                holdStatus = false;
                statusEntered.resolve();
                await resumeStatus.promise;
              }
            }),
          },
        };
        const sync = createExtensionDocumentSync({
          owner,
          deps,
          config: {
            accountId: "account",
            workbenchId: owner.workbenchId,
            environmentId: `device-${index}`,
            managerOrigin: server.url.origin,
            relayOrigin: server.url.origin,
            renewalGrant: "fixture",
          },
          access: async () => ({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        });
        syncs.push(sync);
        if (!cold) await sync.synchronize(controller.signal);
      }
      if (!cold) await syncs[0]!.synchronize(controller.signal);
      held = true;
      for (const sync of syncs) background.push(sync.synchronize(controller.signal));
      await entered.promise;
      if (cold) for (const sync of syncs) expect(await sync.synchronizeDocument(name, controller.signal)).toBe(true);
      for (const load of loads) load.length = 0;
      const local = createExtensionStorageDBService(databases[0]!.db);
      await local.openNativeTextDocument({ owner, fileId: "known" }).save("seed EDIT");
      expect(await syncs[0]!.synchronizeDocument(name, controller.signal)).toBe(true);
      expect(
        await syncs[1]!.synchronizeChanged(
          { type: "changed", spaceOwner: null, documentId, lastSequence: 1, stateId: null },
          controller.signal,
        ),
      ).toBe(true);
      const peer = createExtensionStorageDBService(databases[1]!.db);
      expect(await peer.openNativeTextDocument({ owner, fileId: "known" }).read()).toBe("seed EDIT");
      await Promise.all(syncs.map((sync) => sync.status()));
      for (const load of loads) expect([...new Set(load)]).toEqual([name]);
      expect(heldReads).toBe(2);
      held = false;
      release.resolve();
      await Promise.all(background);
      pauseText = true;
      await local.openNativeTextDocument({ owner, fileId: "known" }).save("seed EDIT ROTATED");
      const old = syncs[0]!.synchronizeDocument(name, controller.signal).then(
        (value) => value,
        (error) => error,
      );
      await rotationEntered.promise;
      keys.push({
        generation: 2,
        secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
      });
      await syncs[0]!.prepare(controller.signal);
      expect(await old).toBe(true);
      expect(
        await syncs[1]!.synchronizeChanged(
          { type: "changed", spaceOwner: null, documentId, lastSequence: 2, stateId: null },
          controller.signal,
        ),
      ).toBe(true);
      expect(await peer.openNativeTextDocument({ owner, fileId: "known" }).read()).toBe("seed EDIT ROTATED");
      expect((await syncs[1]!.status()).needsAttention).toBe(false);
      await local.openNativeTextDocument({ owner, fileId: "known" }).save("FIRST");
      await syncs[0]!.synchronizeDocument(name, controller.signal);
      holdStatus = true;
      const hint = { type: "changed" as const, spaceOwner: null, documentId, lastSequence: 3, stateId: null };
      const first = syncs[1]!.synchronizeChanged(hint, controller.signal);
      await statusEntered.promise;
      await local.openNativeTextDocument({ owner, fileId: "known" }).save("FIRST LATE");
      await syncs[0]!.synchronizeDocument(name, controller.signal);
      const second = syncs[1]!.synchronizeChanged(hint, controller.signal);
      resumeStatus.resolve();
      await Promise.all([first, second]);
      expect(await peer.openNativeTextDocument({ owner, fileId: "known" }).read()).toBe("FIRST LATE");
      retirementId = heldSource === "owner" ? ownerId : streamId;
      retiringBackground = syncs[0]!.synchronize(controller.signal).then(
        (value) => value,
        (error) => error,
      );
      await retirementEntered.promise;
      await local.openNativeTextDocument({ owner, fileId: "known" }).save("LATEST");
      keys.push({
        generation: 3,
        secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
      });
      expect(await syncs[0]!.synchronizeDocument(name, controller.signal)).toBe(true);
      expect(await retiringBackground).toBeUndefined();
      await syncs[1]!.synchronizeChanged(hint, controller.signal);
      expect(await peer.openNativeTextDocument({ owner, fileId: "known" }).read()).toBe("LATEST");
    } finally {
      retirementRelease.resolve();
      resumeStatus.resolve();
      rotationRelease.resolve();
      release.resolve();
      await Promise.allSettled(background);
      await retiringBackground;
      controller.abort();
      await Promise.all(syncs.map((sync) => sync.close()));
      await server.stop(true);
      await Promise.all(databases.map((database) => database.close()));
      await context.cleanup();
    }
  });
