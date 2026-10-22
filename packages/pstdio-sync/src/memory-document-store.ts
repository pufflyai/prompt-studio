import * as Y from "yjs";
import { trackDocumentBinary } from "./document-binary";
import { documentHistory } from "./document-history";
import { type DocumentState, type DocumentStore, memoryDocumentState } from "./document-types";

export const createMemoryDocumentStore = () => {
  const document = new Y.Doc();
  trackDocumentBinary(document, new Uint8Array([0, 0]));
  const state: DocumentState = memoryDocumentState(document);
  let previous = Promise.resolve();
  let previousMigration = Promise.resolve();
  const transaction: DocumentStore["transaction"] = async (_owner, action) => {
    const pending = previous;
    const { promise, resolve } = Promise.withResolvers<void>();
    previous = promise;
    await pending;
    try {
      return await action(state);
    } finally {
      resolve();
    }
  };
  return {
    transaction,
    async duringMigration<T>(key: string, run: () => Promise<T>) {
      const pending = previousMigration;
      const { promise, resolve } = Promise.withResolvers<void>();
      previousMigration = promise;
      await pending;
      const previousSeed = state.migrationSeed;
      const previousHistory = state.migrationHistory;
      state.migrationSeed = key;
      state.migrationHistory = documentHistory(document);
      try {
        return await run();
      } finally {
        state.migrationSeed = previousSeed;
        state.migrationHistory = previousHistory;
        resolve();
      }
    },
  };
};
