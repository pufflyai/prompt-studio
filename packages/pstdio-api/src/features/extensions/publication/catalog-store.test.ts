import { expect, test } from "bun:test";
import { createDocumentStorage, createMemoryDocumentStore, createSyncSpace } from "pstdio-sync";
import { createDocumentSync, type DocumentRelay } from "pstdio-sync/relay";
import type { Asset, StoredUpdate } from "pstdio-sync-contracts";
import { createPublicationCatalog } from "./catalog-store";

test("republishing restores a deleted selection and stale selections cannot overwrite newer choices", async () => {
  const owner = { workbenchId: "project", extensionId: "pstdio.published-extensions" };
  const assets = { verifyComplete: async () => {} } as never;
  const storage = createDocumentStorage({ owner, store: createMemoryDocumentStore(), assets });
  const catalog = createPublicationCatalog({ records: storage.records, verifyComplete: async () => {} });
  const asset = { sha256: "a".repeat(64), byteLength: 1, mediaType: "application/octet-stream" };
  const publication = {
    extensionId: "test.extension",
    revision: asset.sha256,
    version: "1.0.0",
    automation: false,
    enabled: true,
  };
  await catalog.select(publication, asset);
  await storage.records.commit({
    operationId: "uninstall",
    edits: [{ recordId: publication.extensionId, deleted: true }],
  });
  const deleted = await catalog.read(publication.extensionId);
  await catalog.select(publication, asset, deleted.revision);
  expect((await catalog.read(publication.extensionId)).deleted).toBe(false);
  const beforeDisable = await catalog.read(publication.extensionId);
  await catalog.select({ ...publication, enabled: false }, asset, beforeDisable.revision);
  await expect(catalog.select(publication, asset, beforeDisable.revision)).rejects.toThrow("changed");
  expect((await catalog.read(publication.extensionId)).value!.enabled).toBe(false);
});

// Real Yjs merging and blob encryption; the wire only appends opaque encrypted bytes.
test("competing same-version and new-version publications keep package metadata coherent while enabled edits merge", async () => {
  const owner = { workbenchId: "project", extensionId: "pstdio.published-extensions" };
  const updates: StoredUpdate[] = [];
  const ciphertext = new Map<string, Uint8Array>();
  const relay: DocumentRelay = {
    read: async (after) => ({
      status: "updates",
      state: null,
      updates: updates.filter((update) => update.sequence > after),
      more: false,
      lastSequence: updates.length,
    }),
    state: async () => {
      throw new Error("No latest state");
    },
    replace: async () => false,
    update: async (update) => {
      const sequence = updates.length + 1;
      updates.push({ ...update, sequence, deviceId: "device", createdAt: new Date().toISOString() });
      return { sequence, duplicate: false };
    },
    blobs: {
      put: async (id, bytes) => {
        ciphertext.set(id, bytes);
      },
      get: async (id) => ciphertext.get(id)!,
    },
  };
  const space = await createSyncSpace({
    projectId: owner.workbenchId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId("extensions");
  const device = () => {
    const files = new Map<string, Uint8Array>();
    const assets = {
      verifyComplete: async (references: Asset[]) => {
        for (const asset of references) if (!files.has(asset.sha256)) throw new Error("Missing asset");
      },
      read: async (asset: Asset) => new Blob([files.get(asset.sha256)! as Uint8Array<ArrayBuffer>]).stream(),
      receive: async (
        asset: Asset,
        source: (offset: number, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>,
      ) => {
        files.set(
          asset.sha256,
          new Uint8Array(await new Response(await source(0, new AbortController().signal)).arrayBuffer()),
        );
      },
    };
    const store = createMemoryDocumentStore();
    const storage = createDocumentStorage({ owner, store, assets });
    const catalog = createPublicationCatalog({ records: storage.records, verifyComplete: assets.verifyComplete });
    const sync = createDocumentSync({
      owner,
      space,
      documentId,
      store,
      assets,
      relay,
      quarantine: async () => {
        throw new Error("Unexpected quarantine");
      },
    });
    return {
      storage,
      catalog,
      sync,
      publish: async (bytes: string, version: string) => {
        const data = new TextEncoder().encode(bytes);
        const asset = {
          sha256: new Bun.CryptoHasher("sha256").update(data).digest("hex"),
          byteLength: data.length,
          mediaType: "application/octet-stream",
        };
        files.set(asset.sha256, data);
        await catalog.select(
          { extensionId: "test.extension", revision: asset.sha256, version, automation: false, enabled: true },
          asset,
        );
        return asset;
      },
    };
  };
  const a = device();
  const b = device();
  const c = device();
  try {
    await a.publish("base", "1.0.0");
    await a.sync.synchronize();
    await b.sync.synchronize();
    await c.sync.synchronize();
    const same = await a.publish("same-version revision", "1.0.0");
    const next = await b.publish("next-version revision", "2.0.0");
    await a.sync.synchronize();
    await b.sync.synchronize();
    await a.sync.synchronize();
    for (const client of [a, b]) {
      const selected = await client.catalog.read("test.extension");
      expect(selected.asset!.sha256).toBe(selected.value!.revision);
      expect(selected.value!.version).toBe(selected.asset!.sha256 === same.sha256 ? "1.0.0" : "2.0.0");
      expect([same.sha256, next.sha256]).toContain(selected.asset!.sha256);
    }
    // A device that only observed the base disables it while another publishes new bytes.
    await c.storage.records.commit({
      operationId: "disable",
      edits: [
        {
          recordId: "test.extension",
          replace: { ...((await c.storage.records.read("test.extension")).value as object), enabled: false },
        },
      ],
    });
    await c.sync.synchronize();
    await a.sync.synchronize();
    await b.sync.synchronize();
    expect((await a.catalog.read("test.extension")).value!.enabled).toBe(false);
    expect(await a.catalog.read("test.extension")).toEqual(await b.catalog.read("test.extension"));
  } finally {
    a.sync.close();
    b.sync.close();
    c.sync.close();
  }
});
