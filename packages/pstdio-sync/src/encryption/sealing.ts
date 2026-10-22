import { canonicalJson, type Json } from "pstdio-sync-contracts";
import type { SyncSpace } from "./space";

/** Sealed data that this device cannot open: a missing key generation, another space, or changed bytes. */
export class UnreadableSyncData extends Error {
  constructor() {
    super("Sync data cannot be decrypted with this device's keys");
    this.name = "UnreadableSyncData";
  }
}

const formatVersion = 1;
const headerLength = 1 + 4 + 12;

// The context names where the bytes belong. It is authenticated, so the relay cannot move sealed
// bytes to another space, document or ID without the open failing.
// Sync bytes never live in shared memory, which is the only buffer WebCrypto refuses.
const bytes = (value: Uint8Array) => value as Uint8Array<ArrayBuffer>;

const associatedData = (space: SyncSpace, context: Json[]) =>
  new TextEncoder().encode(canonicalJson(["pstdio-sync", space.projectId, space.spaceOwner, ...context]));

// Layout: format version (1 byte), key generation (4 bytes), AES-GCM nonce (12 bytes), ciphertext and tag.
export const seal = async (space: SyncSpace, context: Json[], plain: Uint8Array) => {
  const key = space.key(space.generation)!;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = associatedData(space, context);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, key, bytes(plain)),
  );
  const output = new Uint8Array(headerLength + sealed.length);
  const header = new DataView(output.buffer);
  header.setUint8(0, formatVersion);
  header.setUint32(1, space.generation);
  output.set(iv, 5);
  output.set(sealed, headerLength);
  return output;
};

export const open = async (space: SyncSpace, context: Json[], sealed: Uint8Array) => {
  if (sealed.length < headerLength) throw new UnreadableSyncData();
  const header = new DataView(sealed.buffer, sealed.byteOffset, headerLength);
  const key = space.key(header.getUint32(1));
  if (header.getUint8(0) !== formatVersion || !key) throw new UnreadableSyncData();
  const view = bytes(sealed);
  try {
    const iv = view.subarray(5, headerLength);
    const additionalData = associatedData(space, context);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData },
      key,
      view.subarray(headerLength),
    );
    return new Uint8Array(plain);
  } catch {
    throw new UnreadableSyncData();
  }
};
