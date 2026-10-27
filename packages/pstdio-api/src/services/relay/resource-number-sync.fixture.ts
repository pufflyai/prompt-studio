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
