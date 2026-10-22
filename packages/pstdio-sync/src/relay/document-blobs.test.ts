import { expect, test } from "bun:test";
import type { Asset } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { createSyncSpace, openBlob } from "../encryption";
import { createMemoryDocumentStore } from "../memory-document-store";
import type { AssetStore } from "../types";
import { downloadDocumentBlobs, prepareDocumentBlobs, uploadDocumentBlobs } from "./document-blobs";
import { DocumentBlobMissing } from "./document-sync-types";

const owner = { workbenchId: "project", extensionId: "files" };
const space = await createSyncSpace({
  projectId: owner.workbenchId,
  spaceOwner: null,
  keys: [{ generation: 1, secret: "A".repeat(43) }],
});
const assetStore = () => {
  const files = new Map<string, Uint8Array>();
  const store: AssetStore = {
    async verifyComplete(assets) {
      for (const asset of assets) if (!files.has(asset.sha256)) throw new Error("Missing bytes");
    },
    async read(asset) {
      await store.verifyComplete([asset]);
      return new Blob([files.get(asset.sha256)! as Uint8Array<ArrayBuffer>]).stream();
    },
    async receive(asset, source) {
      if (files.has(asset.sha256)) return;
      const bytes = new Uint8Array(await new Response(await source(0, new AbortController().signal)).arrayBuffer());
      expect(bytes.length).toBe(asset.byteLength);
      expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
      files.set(asset.sha256, bytes);
    },
  };
  return { files, store };
};

test("prepared random blob IDs and ciphertext survive reload and another device decrypts the file", async () => {
  const source = assetStore();
  const target = assetStore();
  const store = createMemoryDocumentStore();
  const bytes = new TextEncoder().encode("offline drawing");
  const asset: Asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "image/svg+xml",
  };
  source.files.set(asset.sha256, bytes);
  await store.transaction(owner, async ({ document }) => {
    document.getMap("records").set("drawing", "drawing-record");
    document.getMap("drawing-record").set("asset", asset);
  });
  const blobs = new Map<string, Uint8Array>();
  const input = {
    owner,
    store,
    space,
    documentId: await space.documentId("files"),
    assets: source.store,
    quarantine: async () => {},
    relay: {
      read: async () => {
        throw new Error("Unused");
      },
      state: async () => new Uint8Array(),
      update: async () => ({ sequence: 1, duplicate: false }),
      replace: async () => true,
      blobs: {
        put: async (id: string, data: Uint8Array) => {
          blobs.set(id, data);
        },
        get: async (id: string) => {
          const bytes = blobs.get(id);
          if (!bytes) throw new DocumentBlobMissing();
          return bytes;
        },
      },
    },
  };
  const local = new Y.Doc();
  Y.applyUpdate(local, await store.transaction(owner, async ({ document }) => Y.encodeStateAsUpdate(document)));
  await prepareDocumentBlobs(input, local);
  const prepared = Y.encodeStateAsUpdate(local);
  const durable = await store.transaction(owner, async ({ document }) => Y.encodeStateAsUpdate(document));
  expect(prepared).toEqual(durable);
  const ids = await uploadDocumentBlobs(input, local);
  expect(ids).toHaveLength(1);
  expect(await openBlob(space, ids[0], blobs.get(ids[0])!)).toEqual(bytes);
  const reload = new Y.Doc();
  Y.applyUpdate(reload, durable);
  await prepareDocumentBlobs(input, reload);
  expect(await uploadDocumentBlobs(input, reload)).toEqual(ids);
  await downloadDocumentBlobs({ ...input, assets: target.store }, reload);
  expect(target.files.get(asset.sha256)).toEqual(bytes);
  // The plaintext can be restaged long after the relay removed the old encrypted blob.
  for (const hash of source.files.keys()) if (hash !== asset.sha256) source.files.delete(hash);
  blobs.clear();
  await prepareDocumentBlobs(input, reload);
  const fresh = await uploadDocumentBlobs(input, reload);
  expect(fresh).toHaveLength(1);
  expect(fresh).not.toEqual(ids);
  expect(await openBlob(space, fresh[0], blobs.get(fresh[0])!)).toEqual(bytes);
  local.destroy();
  reload.destroy();
});
