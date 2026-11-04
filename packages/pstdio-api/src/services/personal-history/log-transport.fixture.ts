import type { DocumentRelay } from "pstdio-sync/relay";
import type { StateEnvelope, StoredUpdate } from "pstdio-sync-contracts";

export const logRelayFixture = () => {
  const updates = new Map<string, StoredUpdate[]>();
  const blobs = new Map<string, Uint8Array>();
  const reads: number[] = [];
  const states = new Map<string, StateEnvelope>();
  const info = (state: StateEnvelope) => ({
    ...state,
    byteLength: Buffer.from(state.payload, "base64").byteLength,
    deviceId: "source",
    createdAt: new Date().toISOString(),
  });
  const relay = (documentId: string): DocumentRelay => ({
    async update(update) {
      const entries = updates.get(documentId) ?? [];
      const sequence = entries.length + 1;
      entries.push({ ...update, sequence, deviceId: "source", createdAt: new Date().toISOString() });
      updates.set(documentId, entries);
      return { sequence, duplicate: false };
    },
    async read(after) {
      reads.push(after);
      const entries = updates.get(documentId) ?? [];
      const page = entries.filter((entry) => entry.sequence > after).slice(0, 1);
      return {
        status: "updates",
        state: states.has(documentId) ? info(states.get(documentId)!) : null,
        lastSequence: entries.length,
        updates: page,
        more: (page.at(-1)?.sequence ?? after) < entries.length,
      };
    },
    async state(id) {
      const state = states.get(documentId);
      if (!state || state.stateId !== id.stateId) throw new Error("Missing session log state");
      return Buffer.from(state.payload, "base64");
    },
    async replace(state) {
      if ((states.get(documentId)?.stateId ?? null) !== state.baseStateId) return false;
      states.set(documentId, state);
      return true;
    },
    async manifestBlobs() {
      return {
        async put(id, bytes, children) {
          if (children.some((child) => !blobs.has(child))) throw new Error("Missing session log child");
          blobs.set(id, bytes.slice());
        },
        async get(id, length) {
          const bytes = blobs.get(id);
          if (!bytes || bytes.byteLength !== length) throw new Error("Missing session log blob extent");
          return bytes.slice();
        },
      };
    },
    blobs: {
      async put(id, bytes) {
        blobs.set(id, bytes);
      },
      async get(id) {
        const bytes = blobs.get(id);
        if (!bytes) throw new Error("Missing blob");
        return bytes;
      },
    },
  });
  return { relay, updates, blobs, reads };
};
