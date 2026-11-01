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
import { storage_current_records, storage_documents } from "../../db/schemas.pg";
import { createEnvironmentDBService } from "../environment/environment";
import { createDocumentCache } from "./document-cache";
import { runDocumentTransaction } from "./document-persistence";
import { createProjectionStatistics } from "./projection-statistics";
import { createRecordStreamStore } from "./record-stream-store";
import { resourceDocumentId } from "./resource-document-persistence";
import type { NumberChange } from "./resource-number-repair";
import { createResourceRecords } from "./resource-records";
import type { StorageDiagnostics } from "./storage-diagnostics";

export const createDocumentStorageDBService = (
  db: DbClient,
  observer?: StorageObserver,
  diagnostics?: StorageDiagnostics,
) => {
  const cache = createDocumentCache();
  const listeners = new Set<(owner: StorageOwner) => void>();
  const numberListeners = new Set<(event: NumberChange) => void>();
  const numbersChanged = (events: NumberChange[]) => {
    for (const event of events) for (const listener of numberListeners) listener(event);
  };
  const statistics = createProjectionStatistics(db);
  let environment: ReturnType<ReturnType<typeof createEnvironmentDBService>["get"]> | undefined;
  const getEnvironment = () => (environment ??= createEnvironmentDBService(db).get());
  const transactionFor = (documentId: string) => {
    const transaction: DocumentStore["transaction"] = async (owner, action) => {
      const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: documentId };
      const key = JSON.stringify(address);
      try {
        const result = await db.transaction((tx) =>
          runDocumentTransaction(tx, { address, owner, cached: cache.get(key), diagnostics }, action),
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
  const revisionFor = (documentId: string) => async (owner: StorageOwner) => {
    const [row] = await db
      .select({ revision: storage_documents.revision })
      .from(storage_documents)
      .where(
        and(
          eq(storage_documents.workbench_id, owner.workbenchId),
          eq(storage_documents.extension_id, owner.extensionId),
          eq(storage_documents.document_id, documentId),
        ),
      );
    return row?.revision ?? 0;
  };
  const isResourceDocument = (id: string) => id.startsWith(resourceDocumentId("").slice(0, -2));
  return {
    transaction,
    observer,
    getEnvironment,
    flushStatistics: statistics.flush,
    watchNumbers(listener: (event: NumberChange) => void) {
      numberListeners.add(listener);
      return () => {
        numberListeners.delete(listener);
      };
    },
    documents: {
      async discard(owner: StorageOwner, documentId: string) {
        const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: documentId };
        await db
          .delete(storage_documents)
          .where(
            and(
              eq(storage_documents.workbench_id, owner.workbenchId),
              eq(storage_documents.extension_id, owner.extensionId),
              eq(storage_documents.document_id, documentId),
            ),
          );
        cache.discard(JSON.stringify(address));
      },
      open: (documentId: string) => ({ transaction: transactionFor(documentId), revision: revisionFor(documentId) }),
      recordStream: (owner: StorageOwner) =>
        createRecordStreamStore(db, owner, {
          statistics,
          numbersChanged,
          metadata: transaction,
          changed: () => {
            for (const listener of listeners) listener(owner);
          },
        }),
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
          for (const { id } of local)
            if (id !== "records" && !isResourceDocument(id) && !directory.has(id)) directory.set(id, true);
          return ["records", ...[...directory.keys()].filter((id) => id !== "records").sort()];
        });
      },
    },
    async hasData(owner: StorageOwner) {
      const [record] = await db
        .select({ id: storage_current_records.record_id })
        .from(storage_current_records)
        .where(
          and(
            eq(storage_current_records.workbench_id, owner.workbenchId),
            eq(storage_current_records.extension_id, owner.extensionId),
          ),
        )
        .limit(1);
      if (record) return true;
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
        if (isResourceDocument(id)) continue;
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
      // The owner document keeps owner metadata such as data migration versions; records have their own documents.
      const metadata = createDocumentStorage({ owner: input.owner, store: { transaction, observer } });
      return {
        dataVersion: metadata.dataVersion,
        setDataVersion: metadata.setDataVersion,
        records: createResourceRecords(db, input.owner, {
          statistics,
          numbersChanged,
          observer,
          assets: input.assets,
          diagnostics,
          changed: () => {
            for (const listener of listeners) listener(input.owner);
          },
        }),
      };
    },
    openTextDocument(input: { owner: StorageOwner; fileId: string }) {
      return createTextDocumentStorage({
        owner: input.owner,
        store: { transaction: transactionFor(JSON.stringify(["text-file", input.fileId])) },
      });
    },
  };
};
