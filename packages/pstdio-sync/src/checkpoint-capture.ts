import * as Y from "yjs";
import { trackDocumentBinary } from "./document-binary";
import { type DocumentStore, memoryDocumentState } from "./document-types";
import type { StorageOwner } from "./types";

/** Stage ordinary save-handler writes as one update without publishing intermediate values. */
export async function captureCheckpoint<T>(
  updates: Uint8Array[],
  owner: StorageOwner,
  action: (store: DocumentStore) => Promise<T>,
  observer?: DocumentStore["observer"],
) {
  const fork = new Y.Doc();
  for (const update of updates) Y.applyUpdate(fork, update);
  const baseline = Y.encodeStateVector(fork);
  trackDocumentBinary(fork, updates);
  const state = memoryDocumentState(fork);
  const store: DocumentStore = {
    observer,
    transaction: async (target, run) => {
      if (target.workbenchId !== owner.workbenchId || target.extensionId !== owner.extensionId)
        throw new Error("A checkpoint cannot cross its storage owner");
      return run(state);
    },
  };
  try {
    const value = await action(store);
    return { value, update: Y.encodeStateAsUpdate(fork, baseline) };
  } finally {
    fork.destroy();
  }
}
