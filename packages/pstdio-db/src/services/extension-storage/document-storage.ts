import { and, eq } from "drizzle-orm";
import {
  type AssetStore,
  createDocumentStorage,
  createTextDocumentStorage,
  type DocumentStore,
  hasDocumentUserData,
  type StorageObserver,
  type StorageOwner,
} from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storage_documents } from "../../db/schemas.pg";
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
    documents: {
      open: (documentId: string) => ({ transaction: transactionFor(documentId) }),
      list: async (owner: StorageOwner) => {
        const local = await db
          .select({ id: storage_documents.document_id })
          .from(storage_documents)
          .where(
            and(
              eq(storage_documents.workbench_id, owner.workbenchId),
              eq(storage_documents.extension_id, owner.extensionId),
            ),
          );
        return transaction(owner, async ({ document }) => {
          // This directory is encrypted with the records document. A new device discovers text
          // documents without revealing filenames or requiring a relay listing API.
          const directory = document.getMap<boolean>("sync-documents");
          for (const { id } of local) if (id !== "records" && !directory.has(id)) directory.set(id, true);
          return ["records", ...[...directory.keys()].filter((id) => id !== "records").sort()];
        });
      },
    },
    async hasData(owner: StorageOwner) {
      const documents = await db
        .select({ id: storage_documents.document_id })
        .from(storage_documents)
        .where(
          and(
            eq(storage_documents.workbench_id, owner.workbenchId),
            eq(storage_documents.extension_id, owner.extensionId),
          ),
        );
      for (const { id } of documents) {
        if (await transactionFor(id)(owner, async ({ document }) => hasDocumentUserData(document))) return true;
      }
      return false;
    },
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
