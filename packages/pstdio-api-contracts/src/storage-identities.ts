import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const formatUuid = (bytes: Uint8Array) => {
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** UUIDv7 keeps random identities ordered by their creation millisecond. */
export const createStorageId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let timestamp = Date.now();
  for (let index = 5; index >= 0; index--) {
    bytes[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return formatUuid(bytes);
};

export const createStorageMigration = (namespace: readonly (string | number)[]) => ({
  id(key: string) {
    const bytes = sha256(new TextEncoder().encode(JSON.stringify([...namespace, key]))).slice(0, 16);
    // Name-derived SHA-256 UUIDs use the custom UUIDv8 layout, not UUIDv5's SHA-1 layout.
    bytes[6] = (bytes[6]! & 0x0f) | 0x80;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    return formatUuid(bytes);
  },
});
