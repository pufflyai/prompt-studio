import { type Asset, assetSchema, syncIdSchema } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { openBlob, sealBlob } from "../encryption";
import type { AssetStore } from "../types";
import { DocumentBlobMissing, type DocumentSyncInput } from "./document-sync-types";

interface BlobReference {
  blobId: string;
  encrypted: Asset;
}
const blobMap = (document: Y.Doc) => document.getMap<BlobReference>("sync-blobs");
const assetsOf = (document: Y.Doc) => {
  const assets = new Map<string, Asset>();
  for (const name of document.getMap<string>("records").values()) {
    const asset = document.getMap(name).get("asset");
    if (asset) {
      const parsed = assetSchema.parse(asset);
      assets.set(parsed.sha256, parsed);
    }
  }
  return assets;
};
const sha256 = async (bytes: Uint8Array) => {
  const hash = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const read = async (assets: AssetStore, asset: Asset) =>
  new Uint8Array(await new Response(await assets.read(asset)).arrayBuffer());
const save = async (assets: AssetStore, asset: Asset, bytes: Uint8Array) =>
  assets.receive(asset, async (offset) => new Blob([bytes.subarray(offset) as Uint8Array<ArrayBuffer>]).stream());
const complete = async (assets: AssetStore, asset: Asset) => {
  try {
    await assets.verifyComplete([asset]);
    return true;
  } catch {
    return false;
  }
};
const requireAssets = (input: DocumentSyncInput) => {
  if (!input.assets || !input.relay.blobs) throw new Error("Document blob transport is unavailable");
  return { assets: input.assets, blobs: input.relay.blobs };
};
const encryptedBytes = async (input: DocumentSyncInput, reference: BlobReference) => {
  const { assets, blobs } = requireAssets(input);
  if (!(await complete(assets, reference.encrypted))) {
    if (blobs.read) {
      const receive = blobs.read;
      await assets.receive(reference.encrypted, (offset) => receive(reference.blobId, offset));
    } else await save(assets, reference.encrypted, await blobs.get(reference.blobId));
  }
  return read(assets, reference.encrypted);
};

export const validateDocumentBlobs = (document: Y.Doc) => {
  for (const hash of assetsOf(document).keys()) {
    const reference = blobMap(document).get(hash);
    if (!reference) throw new Error("Synced asset has no blob ID");
    syncIdSchema.parse(reference.blobId);
    assetSchema.parse(reference.encrypted);
  }
};

export const prepareDocumentBlobs = async (input: DocumentSyncInput, document: Y.Doc) => {
  while (true) {
    const active = assetsOf(document);
    const prepared = new Map<string, { previous?: string; reference: BlobReference }>();
    for (const [hash, asset] of active) {
      const { assets } = requireAssets(input);
      const previous = blobMap(document).get(hash);
      if (previous) {
        try {
          await encryptedBytes(input, previous);
          continue;
        } catch (error) {
          if (!(error instanceof DocumentBlobMissing)) throw error;
        }
      }
      const sealed = await sealBlob(input.space, await read(assets, asset));
      const encrypted = {
        sha256: await sha256(sealed.bytes),
        byteLength: sealed.bytes.length,
        mediaType: "application/octet-stream",
      };
      // Persist the ciphertext before its random relay ID enters the document. Retries and restarts
      // must reuse these bytes. A missing cache can be rebuilt from the complete local plaintext.
      await save(assets, encrypted, sealed.bytes);
      prepared.set(hash, { previous: previous?.blobId, reference: { blobId: sealed.blobId, encrypted } });
    }
    if (!prepared.size) return;
    const update = await input.store.transaction(input.owner, async (state) => {
      const current = blobMap(state.document);
      for (const [hash, entry] of prepared)
        if (current.get(hash)?.blobId === entry.previous) current.set(hash, entry.reference);
      // Offline edits may reuse an inactive hash. Keep its mapping, but list only live blob IDs
      // in relay envelopes so these descriptors do not pin unused ciphertext on the relay.
      return Y.encodeStateAsUpdate(state.document);
    });
    Y.applyUpdate(document, update);
  }
};

export const downloadDocumentBlobs = async (input: DocumentSyncInput, document: Y.Doc) => {
  for (const [hash, asset] of assetsOf(document)) {
    const { assets } = requireAssets(input);
    if (await complete(assets, asset)) continue;
    const reference = blobMap(document).get(hash);
    if (!reference) throw new Error("Synced asset has no blob ID");
    const bytes = await encryptedBytes(input, reference);
    await save(assets, asset, await openBlob(input.space, reference.blobId, bytes));
  }
};

export const uploadDocumentBlobs = async (input: DocumentSyncInput, document: Y.Doc) => {
  const ids: string[] = [];
  for (const hash of assetsOf(document).keys()) {
    const reference = blobMap(document).get(hash);
    if (!reference) throw new Error("Local asset has no blob ID");
    const { blobs } = requireAssets(input);
    await blobs.put(reference.blobId, await encryptedBytes(input, reference));
    ids.push(reference.blobId);
  }
  return [...new Set(ids)];
};
