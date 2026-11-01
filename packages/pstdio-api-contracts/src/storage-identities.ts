import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { createStorageMigrationPosition } from "./storage-migration-positions";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const formatStorageId = (bytes: Uint8Array, prefix?: string) => {
  if (prefix !== undefined) {
    if (!/^[a-z][a-z0-9]{0,15}$/.test(prefix))
      throw new Error("ID prefix must start with a lowercase letter and contain 1 to 16 lowercase letters or digits");
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    let body = "";
    do {
      body = alphabet[Number(value % 62n)] + body;
      value /= 62n;
    } while (value > 0n);
    return `${prefix}_${body.padStart(22, "0")}`;
  }
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** UUIDv7 keeps random identities ordered by their creation millisecond. */
export const createStorageId = (prefix?: string) => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let timestamp = Date.now();
  for (let index = 5; index >= 0; index--) {
    bytes[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return formatStorageId(bytes, prefix);
};

export const createStorageMigration = (namespace: readonly (string | number)[]) => ({
  position: createStorageMigrationPosition,
  id(key: string, prefix?: string) {
    const bytes = sha256(new TextEncoder().encode(JSON.stringify([...namespace, key]))).slice(0, 16);
    // Name-derived SHA-256 UUIDs use the custom UUIDv8 layout, not UUIDv5's SHA-1 layout.
    bytes[6] = (bytes[6]! & 0x0f) | 0x80;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    return formatStorageId(bytes, prefix);
  },
});
