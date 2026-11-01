import * as Y from "yjs";
import type { StorageOwner } from "../shared";
import { type DocumentStore, memoryDocumentState } from "../shared";

/** Stage ordinary save-handler writes as one update without publishing intermediate values. */
export async function captureCheckpoint<T>(
  document: Y.Doc,
  owner: StorageOwner,
  action: (store: DocumentStore) => Promise<T>,
  observer?: DocumentStore["observer"],
) {
  const fork = new Y.Doc();
  const baseline = Y.encodeStateVector(document);
  Y.applyUpdate(fork, Y.encodeStateAsUpdate(document));
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
