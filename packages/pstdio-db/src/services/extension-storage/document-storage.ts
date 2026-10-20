import {
  type AssetStore,
  createDocumentStorage,
  createTextDocumentStorage,
  type DocumentStore,
  type StorageObserver,
  type StorageOwner,
} from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { createEnvironmentDBService } from "../environment/environment";
import { createDocumentCache } from "./document-cache";
import { runDocumentTransaction } from "./document-persistence";

export const createDocumentStorageDBService = (db: DbClient, observer?: StorageObserver) => {
  const cache = createDocumentCache();
  const listeners = new Set<(owner: StorageOwner) => void>();
  let environment: ReturnType<ReturnType<typeof createEnvironmentDBService>["get"]> | undefined;
  const getEnvironment = () => (environment ??= createEnvironmentDBService(db).get());
  const transactionFor = (documentId: string) => {
    const transaction: DocumentStore["transaction"] = async (owner, action) => {
      const { environmentId } = await getEnvironment();
      const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: documentId };
      const key = JSON.stringify(address);
      try {
        const result = await db.transaction((tx) =>
          runDocumentTransaction(tx, { address, owner, environmentId, cached: cache.get(key) }, action),
        );
        cache.publish(key, result);
        if (result.changed) for (const listener of listeners) listener(owner);
        return result.value;
      } catch (error) {
        cache.discard(key);
        throw error;
      }
    };
    return transaction;
  };
  const transaction = transactionFor("records");
  return {
    transaction,
    observer,
    getEnvironment,
    watch(listener: (owner: StorageOwner) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    open(input: { owner: StorageOwner; assets?: AssetStore }) {
      return createDocumentStorage({ ...input, store: { transaction, observer } });
    },
    openTextDocument(input: { owner: StorageOwner; fileId: string }) {
      return createTextDocumentStorage({
        owner: input.owner,
        store: { transaction: transactionFor(JSON.stringify(["text-file", input.fileId])) },
      });
    },
  };
};
