import * as Y from "yjs";
import { exportDocumentBinary, trackDocumentBinary } from "./document-binary";
import { type DocumentStore, memoryDocumentState } from "./document-types";
import type { StorageOwner } from "./types";

/** Stage ordinary save-handler writes as one update without publishing intermediate values. */
export async function captureCheckpoint<T>(
  document: Y.Doc,
  owner: StorageOwner,
  action: (store: DocumentStore) => Promise<T>,
  observer?: DocumentStore["observer"],
) {
  const fork = new Y.Doc();
  const baseline = Y.encodeStateVector(document);
  const update = exportDocumentBinary(document);
  Y.applyUpdate(fork, update);
  trackDocumentBinary(fork, update);
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
