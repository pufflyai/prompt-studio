import * as Y from "yjs";
import { documentHistory } from "./document-history";
import { type DocumentState, type DocumentStore, memoryDocumentState } from "./document-types";

export const createMemoryDocumentStore = () => {
  const document = new Y.Doc();
  const state: DocumentState = memoryDocumentState(document);
  let revision = 0;
  document.on("update", () => revision++);
  let previous = Promise.resolve();
  let previousMigration = Promise.resolve();
  const transaction: DocumentStore["transaction"] = async (_owner, action) => {
    const pending = previous;
    const { promise, resolve } = Promise.withResolvers<void>();
    previous = promise;
    await pending;
    try {
      return await action({ ...state, revision });
    } finally {
      resolve();
    }
  };
  return {
    transaction,
    revision: async () => {
      await previous;
      return revision;
    },
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
