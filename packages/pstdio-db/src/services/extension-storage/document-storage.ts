import { and, eq } from "drizzle-orm";
import { type AssetStore, hasDocumentUserData, type StorageObserver, type StorageOwner } from "pstdio-sync";
import { createDocumentStorage } from "pstdio-sync/records";
import { createTextDocumentStorage } from "pstdio-sync/text";
import type { StorageTextDeclaration } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records, storage_documents } from "../../db/schemas.pg";
import { createEnvironmentDBService } from "../environment/environment";
import { createDocumentCache } from "./document-cache";
import { createDocumentDirectory } from "./document-directory";
import { createDocumentTransactions } from "./document-transactions";
import { createNativeDocumentStore, openNativeDocument } from "./native-document-storage";
import { createOrderedCloudReturn } from "./ordered-cloud-return";
import { createOrderedLogs } from "./ordered-logs";
import { createOrderedResourceRecords } from "./ordered-resource-records";
import { createOrderedStreamStore } from "./ordered-stream-store";
import { createProjectionStatistics } from "./projection-statistics";
import { resourceDocumentId } from "./resource-document-persistence";
import type { NumberChange } from "./resource-number-repair";
import type { StorageDiagnostics } from "./storage-diagnostics";

const notifyNativeRecords = (listeners: Map<string, Set<() => void>>, owner: StorageOwner, keys: string[]) => {
  for (const documentKey of keys) {
    const key = JSON.stringify({
      workbench_id: owner.workbenchId,
      extension_id: owner.extensionId,
      document_id: JSON.stringify(["native-markdown", documentKey]),
    });
    for (const listener of listeners.get(key) ?? []) listener();
  }
};

const addressFor = (owner: StorageOwner, documentId: string) => ({
  workbench_id: owner.workbenchId,
  extension_id: owner.extensionId,
  document_id: documentId,
});
const notifyNumbers = (listeners: Set<(event: NumberChange) => void>, events: NumberChange[]) => {
  for (const event of events) for (const listener of listeners) listener(event);
};

const hasProjectedRecords = async (db: DbClient, owner: StorageOwner) => {
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
  return !!record;
};
type StorageChange = StorageOwner & { documentId?: string };

const documentRevision = (db: DbClient, documentId: string) => async (owner: StorageOwner) => {
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

const discardDocument = async (
  db: DbClient,
  cache: ReturnType<typeof createDocumentCache>,
  owner: StorageOwner,
  documentId: string,
) => {
  const address = addressFor(owner, documentId);
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
};

export const createDocumentStorageDBService = (
  db: DbClient,
  observer?: StorageObserver,
  diagnostics?: StorageDiagnostics,
) => {
  const cache = createDocumentCache();
  const listeners = new Set<(owner: StorageChange, origin?: "relay") => void>();
  const documentListeners = new Map<string, Set<() => void>>();
  const numberListeners = new Set<(event: NumberChange) => void>();
  const notifyOwnerNative = (owner: StorageOwner) => {
    for (const [key, callbacks] of documentListeners) {
      const address = JSON.parse(key) as { workbench_id: string; extension_id: string; document_id: string };
      if (
        address.workbench_id === owner.workbenchId &&
        address.extension_id === owner.extensionId &&
        address.document_id.startsWith('["native-markdown",')
      )
        for (const listener of callbacks) listener();
    }
  };
  const numbersChanged = (events: NumberChange[]) => notifyNumbers(numberListeners, events);
  const statistics = createProjectionStatistics(db);
  let environment: ReturnType<ReturnType<typeof createEnvironmentDBService>["get"]> | undefined;
  const getEnvironment = () => (environment ??= createEnvironmentDBService(db).get());
  let directory: ReturnType<typeof createDocumentDirectory>;
  const transactionFor = createDocumentTransactions(db, {
    cache,
    diagnostics,
    directory: () => directory,
    projected: statistics.record,
    published: (owner, documentId) => {
      for (const listener of listeners) listener({ ...owner, documentId });
      for (const listener of documentListeners.get(JSON.stringify(addressFor(owner, documentId))) ?? []) listener();
    },
  });
  const transaction = transactionFor("records");
  const nativeStore = (id: string) => createNativeDocumentStore(db, id, transactionFor, documentRevision(db, id));
  const isResourceDocument = (id: string) =>
    id.startsWith(resourceDocumentId("").slice(0, -2)) ||
    id.startsWith('["ordered-index-blob",') ||
    id.startsWith('["ordered-native-field",') ||
    id.startsWith('["ordered-native-room",') ||
    id.startsWith('["ordered-native-authored",') ||
    id.startsWith('["ordered-dependency",') ||
    id.startsWith('["ordered-replaced",') ||
    id === '["ordered-return"]' ||
    id === '["ordered-directory"]';
  directory = createDocumentDirectory(db, {
    metadata: transaction,
    private: isResourceDocument,
    invalidate: (owner) => cache.discard(JSON.stringify(addressFor(owner, "records"))),
  });
  const logs = createOrderedLogs(db, {
    metadata: transaction,
    changed: (owner) => {
      for (const listener of listeners) listener(owner);
    },
  });
  const cloudReturn = createOrderedCloudReturn(db, {
    changed: (owner) => {
      notifyOwnerNative(owner);
      for (const listener of listeners) listener(owner);
    },
  });
  return {
    transaction,
    logs,
    cloudReturn,
    observer,
    getEnvironment,
    flushStatistics: async () => {
      await statistics.flush();
      await logs.flushStatistics();
    },
    watchNumbers(listener: (event: NumberChange) => void) {
      numberListeners.add(listener);
      return () => {
        numberListeners.delete(listener);
      };
    },
    documents: {
      discard: (owner: StorageOwner, documentId: string) => discardDocument(db, cache, owner, documentId),
      open: (documentId: string) =>
        documentId.startsWith('["native-markdown",')
          ? nativeStore(documentId)
          : { transaction: transactionFor(documentId), revision: documentRevision(db, documentId) },
      recordStream: (owner: StorageOwner) =>
        createOrderedStreamStore(db, owner, {
          statistics,
          numbersChanged,
          metadata: transaction,
          changed: () => {
            notifyOwnerNative(owner);
            for (const listener of listeners) listener(owner, "relay");
          },
        }),
      list: (owner: StorageOwner) => directory.list(owner),
    },
    async hasData(owner: StorageOwner) {
      if (await hasProjectedRecords(db, owner)) return true;
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
    watch(listener: (owner: StorageChange, origin?: "relay") => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    open(input: { owner: StorageOwner; assets?: AssetStore; textFields?: StorageTextDeclaration[] }) {
      // The owner document keeps owner metadata such as data migration versions; records have their own documents.
      const metadata = createDocumentStorage({ owner: input.owner, store: { transaction, observer } });
      return {
        dataVersion: metadata.dataVersion,
        setDataVersion: metadata.setDataVersion,
        records: createOrderedResourceRecords(db, input.owner, {
          statistics,
          numbersChanged,
          observer,
          assets: input.assets,
          textFields: input.textFields,
          diagnostics,
          nativeChanged: (keys) => {
            notifyNativeRecords(documentListeners, input.owner, keys);
            for (const key of keys)
              for (const listener of listeners)
                listener({ ...input.owner, documentId: JSON.stringify(["native-markdown", key]) });
          },
          changed: () => {
            notifyOwnerNative(input.owner);
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
    openNativeTextDocument(input: { owner: StorageOwner; fileId: string }) {
      return openNativeDocument(input, {
        db,
        transactionFor,
        nativeStore,
        watch: (owner, id, listener) => {
          const key = JSON.stringify(addressFor(owner, id));
          let callbacks = documentListeners.get(key);
          if (!callbacks) {
            callbacks = new Set();
            documentListeners.set(key, callbacks);
          }
          callbacks.add(listener);
          return () => {
            callbacks.delete(listener);
            if (!callbacks.size) documentListeners.delete(key);
          };
        },
      });
    },
  };
};
