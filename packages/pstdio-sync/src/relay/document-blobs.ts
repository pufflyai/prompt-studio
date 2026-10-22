import type { Asset } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { openBlob, sealBlob } from "../encryption";
import type { AssetStore } from "../types";
import {
  type BlobReference,
  type DocumentBlob,
  documentBlobManifest,
  validateDocumentBlobManifest,
} from "./document-blob-manifest";
import { DocumentBlobMissing, type DocumentSyncInput } from "./document-sync-types";

const blobMap = (document: Y.Doc) => document.getMap<BlobReference>("sync-blobs");
const manifestOf = (document: Y.Doc | DocumentBlob[]) =>
  Array.isArray(document) ? document : documentBlobManifest(document);
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
  if (!(await complete(assets, reference.encrypted)))
    await save(assets, reference.encrypted, await blobs.get(reference.blobId));
  return read(assets, reference.encrypted);
};

export const validateDocumentBlobs = (document: Y.Doc) => validateDocumentBlobManifest(documentBlobManifest(document));

export const prepareDocumentBlobManifest = async (input: DocumentSyncInput, manifest: DocumentBlob[]) => {
  const prepared = new Map<string, { previous?: string; reference: BlobReference }>();
  for (const { asset, reference: previous } of manifest) {
    const { assets } = requireAssets(input);
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
    // Ciphertext is durable before its random relay ID enters the document.
    await save(assets, encrypted, sealed.bytes);
    prepared.set(asset.sha256, { previous: previous?.blobId, reference: { blobId: sealed.blobId, encrypted } });
  }
  if (!prepared.size) return null;
  return input.store.transaction(input.owner, async ({ document }) => {
    const updates: Uint8Array[] = [];
    const capture = (update: Uint8Array) => updates.push(update);
    document.on("update", capture);
    try {
      document.transact(() => {
        const current = blobMap(document);
        for (const [hash, entry] of prepared)
          if (current.get(hash)?.blobId === entry.previous) current.set(hash, entry.reference);
      });
      return updates.length ? Y.mergeUpdates(updates) : null;
    } finally {
      document.off("update", capture);
    }
  });
};

export const prepareDocumentBlobs = async (input: DocumentSyncInput, document: Y.Doc) => {
  while (true) {
    const update = await prepareDocumentBlobManifest(input, documentBlobManifest(document));
    if (!update) return;
    Y.applyUpdate(document, update);
  }
};

export const downloadDocumentBlobs = async (input: DocumentSyncInput, document: Y.Doc | DocumentBlob[]) => {
  for (const { asset, reference } of manifestOf(document)) {
    const { assets } = requireAssets(input);
    if (await complete(assets, asset)) continue;
    if (!reference) throw new Error("Synced asset has no blob ID");
    const bytes = await encryptedBytes(input, reference);
    await save(assets, asset, await openBlob(input.space, reference.blobId, bytes));
  }
};

export const uploadDocumentBlobs = async (input: DocumentSyncInput, document: Y.Doc | DocumentBlob[]) => {
  const ids: string[] = [];
  for (const { reference } of manifestOf(document)) {
    if (!reference) throw new Error("Local asset has no blob ID");
    const { blobs } = requireAssets(input);
    await blobs.put(reference.blobId, await encryptedBytes(input, reference));
    ids.push(reference.blobId);
  }
  return [...new Set(ids)];
};
