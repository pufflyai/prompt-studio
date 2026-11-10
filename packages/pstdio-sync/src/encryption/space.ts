import { type SpaceKey, spaceKeySchema } from "pstdio-sync-contracts";
import { decodeBytes, encodeBytes } from "../shared";

const encoder = new TextEncoder();
export const toBase64url = (bytes: Uint8Array) =>
  encodeBytes(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fromBase64url = (value: string) => decodeBytes(value.replaceAll("-", "+").replaceAll("_", "/"));

type Derivation = Parameters<typeof crypto.subtle.deriveKey>;

const deriveKey = async (secret: string, info: string, algorithm: Derivation[2], usages: Derivation[4]) => {
  const root = await crypto.subtle.importKey("raw", fromBase64url(secret), "HKDF", false, ["deriveKey"]);
  const parameters = { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: encoder.encode(info) };
  return crypto.subtle.deriveKey(parameters, root, algorithm, false, usages);
};

/**
 * One project or personal space and the keys of every generation its devices received.
 * New data is sealed with the newest generation; older generations stay so older data stays readable.
 */
export const createSyncSpace = async (input: { projectId: string; spaceOwner: string | null; keys: SpaceKey[] }) => {
  const keys = input.keys.map((key) => spaceKeySchema.parse(key)).sort((a, b) => a.generation - b.generation);
  if (!keys.length) throw new Error("A sync space needs at least one key");
  const encryption = new Map(
    await Promise.all(
      keys.map(
        async (key) =>
          [
            key.generation,
            await deriveKey(key.secret, "pstdio-sync encryption v1", { name: "AES-GCM", length: 256 }, [
              "encrypt",
              "decrypt",
            ]),
          ] as const,
      ),
    ),
  );
  // Document IDs come from the first generation, so a rotation never moves a document.
  const naming = await deriveKey(keys[0].secret, "pstdio-sync document id v1", { name: "HMAC", hash: "SHA-256" }, [
    "sign",
  ]);
  return spaceFromKeys({
    projectId: input.projectId,
    spaceOwner: input.spaceOwner,
    generation: keys[keys.length - 1].generation,
    encryption: [...encryption],
    naming,
  });
};

/** A space's derived, non-extractable keys, which a structured clone can carry to a worker thread. */
export interface SyncSpaceTransfer {
  projectId: string;
  spaceOwner: string | null;
  generation: number;
  encryption: [number, CryptoKey][];
  naming: CryptoKey;
}

const spaceFromKeys = (input: SyncSpaceTransfer) => {
  const encryption = new Map(input.encryption);
  return {
    projectId: input.projectId,
    spaceOwner: input.spaceOwner,
    generation: input.generation,
    key: (generation: number) => encryption.get(generation),
    /** The relay document ID for a local document name. Every device of the space derives the same ID. */
    async documentId(name: string) {
      const digest = new Uint8Array(await crypto.subtle.sign("HMAC", input.naming, encoder.encode(name)));
      return toBase64url(digest.subarray(0, 16));
    },
    /** For a worker in this process; the keys stay non-extractable on both sides. */
    transfer: (): SyncSpaceTransfer => ({ ...input, encryption: [...encryption] }),
  };
};

export const restoreSyncSpace = (transfer: SyncSpaceTransfer) => spaceFromKeys(transfer);

export type SyncSpace = Awaited<ReturnType<typeof createSyncSpace>>;

/** A random relay ID for a blob, update or latest state. */
export const createSyncId = () => toBase64url(crypto.getRandomValues(new Uint8Array(16)));
