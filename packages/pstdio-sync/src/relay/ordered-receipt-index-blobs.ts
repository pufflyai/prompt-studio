import { blobReferenceFanout, type Json, jsonSchema, syncIdSchema } from "pstdio-sync-contracts";
import { openBlob, type SyncSpace, sealBlob } from "../encryption";

export interface OrderedIndexReference {
  blobId: string;
  byteLength: number;
}
export interface OrderedIndexBlobs {
  /** Commit a bounded transfer page's local cache writes together. */
  batch?<T>(run: () => Promise<T>): Promise<T>;
  put(blobId: string, bytes: Uint8Array, children: string[]): Promise<void>;
  /** The extent comes from the authenticated parent or checkpoint. */
  get(blobId: string, byteLength: number): Promise<Uint8Array>;
  /** Persist validated encrypted graph edges for a full local writer's loss recovery. */
  remember?(reference: OrderedIndexReference, children: OrderedIndexReference[]): Promise<void>;
}

export const readOrderedIndexReference = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid index reference");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || !Object.hasOwn(value, "blobId") || !Object.hasOwn(value, "byteLength"))
    throw new Error("Invalid index reference fields");
  syncIdSchema.parse(value.blobId);
  if (typeof value.byteLength !== "number" || !Number.isSafeInteger(value.byteLength) || value.byteLength < 1)
    throw new Error("Invalid index reference extent");
  return { blobId: value.blobId as string, byteLength: value.byteLength };
};

/** Shared encrypted node transport; each index owns and validates its plaintext page format. */
export const createEncryptedManifestNodes = (space: SyncSpace, blobs: OrderedIndexBlobs) => ({
  async retain(reference: OrderedIndexReference, children: OrderedIndexReference[]) {
    const parent = readOrderedIndexReference(reference);
    const edges = children.map(readOrderedIndexReference);
    if (edges.length > blobReferenceFanout || new Set(edges.map((child) => child.blobId)).size !== edges.length)
      throw new Error("Manifest node children must be bounded and unique");
    await blobs.remember?.(parent, edges);
  },
  async read(input: OrderedIndexReference) {
    const reference = readOrderedIndexReference(input);
    const bytes = await blobs.get(reference.blobId, reference.byteLength);
    if (bytes.length !== reference.byteLength)
      throw new Error("Manifest node length differs from authenticated extent");
    const plain = await openBlob(space, reference.blobId, bytes);
    return jsonSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain)));
  },
  async write(input: Json, children: OrderedIndexReference[]) {
    // Capture both payload and graph edges before crypto yields to caller code.
    const bytes = new TextEncoder().encode(JSON.stringify(jsonSchema.parse(input)));
    const references = children.map(readOrderedIndexReference);
    const ids = references.map((reference) => reference.blobId);
    if (ids.length > blobReferenceFanout || new Set(ids).size !== ids.length)
      throw new Error("Manifest node children must be bounded and unique");
    const sealed = await sealBlob(space, bytes);
    await blobs.put(sealed.blobId, sealed.bytes, ids);
    const reference = { blobId: sealed.blobId, byteLength: sealed.bytes.length };
    await blobs.remember?.(reference, references);
    return reference;
  },
});
