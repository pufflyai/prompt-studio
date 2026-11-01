import type { DocumentRelay } from "pstdio-sync/relay";
import type { StoredUpdate } from "pstdio-sync-contracts";

export const logRelayFixture = () => {
  const updates = new Map<string, StoredUpdate[]>();
  const blobs = new Map<string, Uint8Array>();
  const reads: number[] = [];
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
        state: null,
        lastSequence: entries.length,
        updates: page,
        more: (page.at(-1)?.sequence ?? after) < entries.length,
      };
    },
    async state() {
      throw new Error("Session logs never have a state");
    },
    async replace() {
      throw new Error("Session logs never replace a state");
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
