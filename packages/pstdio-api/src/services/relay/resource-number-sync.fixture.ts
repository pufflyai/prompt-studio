import type { DocumentRelay } from "pstdio-sync/relay";
import type { StateEnvelope, StateInfo, StoredUpdate } from "pstdio-sync-contracts";

/** Independent encrypted relay documents, without account or network setup. */
export const numberRelayFixture = () => {
  const documents = new Map<string, ReturnType<typeof documentRelay>>();
  const documentRelay = () => {
    let latest: (StateEnvelope & StateInfo) | null = null;
    let sequence = 0;
    const updates: StoredUpdate[] = [];
    const blobs = new Map<string, Uint8Array>();
    const edges = new Map<string, string[]>();
    const requests = { reads: 0, writes: 0 };
    const relay: DocumentRelay = {
      read: async (after) => {
        requests.reads++;
        return {
          status: "updates",
          state: latest,
          lastSequence: sequence,
          updates: updates.filter((update) => update.sequence > after),
          more: false,
        };
      },
      state: async () => new Uint8Array(Buffer.from(latest!.payload, "base64")),
      update: async (update) => {
        requests.writes++;
        updates.push({ ...update, sequence: ++sequence, deviceId: "device", createdAt: new Date().toISOString() });
        return { sequence, duplicate: false };
      },
      replace: async (state) => {
        if (state.baseStateId !== (latest?.stateId ?? null)) return false;
        requests.writes++;
        latest = {
          ...state,
          byteLength: Buffer.from(state.payload, "base64").byteLength,
          deviceId: "device",
          createdAt: new Date().toISOString(),
        };
        return true;
      },
      blobs: {
        put: async (id, bytes) => {
          blobs.set(id, bytes);
        },
        get: async (id) => blobs.get(id)!,
      },
      manifestBlobs: async () => ({
        async put(id, bytes, children) {
          if (
            children.length > 256 ||
            new Set(children).size !== children.length ||
            children.some((child) => !blobs.has(child))
          )
            throw new Error("Invalid manifest children");
          const ordered = [...children].sort();
          const previous = edges.get(id);
          if (previous && JSON.stringify(previous) !== JSON.stringify(ordered))
            throw new Error("Manifest children are immutable");
          if (blobs.has(id) && !Buffer.from(blobs.get(id)!).equals(bytes))
            throw new Error("Encrypted blob is immutable");
          blobs.set(id, bytes.slice());
          edges.set(id, ordered);
        },
        async get(id, byteLength) {
          const bytes = blobs.get(id);
          if (!bytes || bytes.length !== byteLength) throw new Error("Missing or invalid manifest extent");
          return bytes.slice();
        },
      }),
    };
    return { relay, requests };
  };
  const get = (id: string) => {
    let document = documents.get(id);
    if (!document) {
      document = documentRelay();
      documents.set(id, document);
    }
    return document;
  };
  return { relay: (id: string) => get(id).relay, requests: (id: string) => get(id).requests };
};
