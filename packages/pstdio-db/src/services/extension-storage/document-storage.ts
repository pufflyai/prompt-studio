import { and, eq, isNotNull } from "drizzle-orm";
import { canonicalOwner } from "pstdio-api-contracts/extension-host";
import { type AssetStore, hasDocumentUserData, type StorageObserver, type StorageOwner } from "pstdio-sync";
import { createDocumentStorage } from "pstdio-sync/records";
import { createTextDocumentStorage } from "pstdio-sync/text";
import type { StorageTextDeclaration } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { deleteStorageDocuments } from "../../db/delete-storage-documents";
import { documents as storage_documents } from "../../db/schemas/documents";
import { records } from "../../db/schemas.pg";
import { assertStorageOwnerAdmitted } from "../../db/storage-admission";
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
import { storageOwnerKey } from "./storage-owner-key";

type NativeChange = { recordIds?: readonly string[] };
type NativeListener = (change?: NativeChange) => void;
const notifyNativeRecords = (listeners: Map<string, Set<NativeListener>>, owner: StorageOwner, keys: string[]) => {
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
    .select({ id: records.record_id })
    .from(records)
    .where(and(eq(records.owner_id, storageOwnerKey(owner)), isNotNull(records.revision)))
    .limit(1);
  return !!record;
};
export type StorageChange = StorageOwner & { documentId?: string; recordIds?: readonly string[] };

const documentRevision = (db: DbClient, documentId: string) => async (owner: StorageOwner) => {
  assertStorageOwnerAdmitted(db, owner);
  const [row] = await db
    .select({ revision: storage_documents.revision })
    .from(storage_documents)
    .where(and(eq(storage_documents.owner_id, storageOwnerKey(owner)), eq(storage_documents.key, documentId)));
  return row?.revision ?? 0;
};

const discardDocument = async (
  db: DbClient,
  cache: ReturnType<typeof createDocumentCache>,
  owner: StorageOwner,
  documentId: string,
) => {
  assertStorageOwnerAdmitted(db, owner);
  const address = addressFor(owner, documentId);
  await deleteStorageDocuments(
    db,
    and(eq(storage_documents.owner_id, storageOwnerKey(owner)), eq(storage_documents.key, documentId))!,
  );
  cache.discard(JSON.stringify(address));
};

export const createDocumentStorageDBService = (
  db: DbClient,
  observer?: StorageObserver,
  diagnostics?: StorageDiagnostics,
  withProjectWork?: <T>(id: string, task: () => Promise<T>) => Promise<T>,
) => {
  const cache = createDocumentCache();
  const listeners = new Set<(owner: StorageChange, origin?: "relay") => void>();
  const documentListeners = new Map<string, Set<NativeListener>>();
  const numberListeners = new Set<(event: NumberChange) => void>();
  const notifyOwnerNative = (owner: StorageOwner, recordIds?: readonly string[]) => {
    for (const [key, callbacks] of documentListeners) {
      const address = JSON.parse(key) as { workbench_id: string; extension_id: string; document_id: string };
      if (
        address.workbench_id === owner.workbenchId &&
        address.extension_id === owner.extensionId &&
        address.document_id.startsWith('["native-markdown",')
      )
        for (const listener of callbacks) listener({ recordIds });
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
    id.startsWith('["editor-room",') ||
    id.startsWith('["host-local-migration",') ||
    id.startsWith(resourceDocumentId("").slice(0, -2)) ||
    id.startsWith('["ordered-conversion') ||
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
    withProjectWork,
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
        createOrderedStreamStore(db, canonicalOwner(owner), {
          statistics,
          numbersChanged,
          metadata: transaction,
          changed: (recordIds) => {
            notifyOwnerNative(owner, recordIds);
            for (const listener of listeners) listener({ ...owner, ...(recordIds && { recordIds }) }, "relay");
          },
        }),
      list: (owner: StorageOwner) => directory.list(canonicalOwner(owner)),
    },
    async hasData(owner: StorageOwner) {
      owner = canonicalOwner(owner);
      assertStorageOwnerAdmitted(db, owner);
      if (await hasProjectedRecords(db, owner)) return true;
      const documents = await db
        .select({ id: storage_documents.key })
        .from(storage_documents)
        .where(and(eq(storage_documents.owner_id, storageOwnerKey(owner)), eq(storage_documents.kind, "shared")));
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
      input = { ...input, owner: canonicalOwner(input.owner) };
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
          withProjectWork,
          nativeChanged: (keys) => {
            notifyNativeRecords(documentListeners, input.owner, keys);
            for (const key of keys)
              for (const listener of listeners)
                listener({ ...input.owner, documentId: JSON.stringify(["native-markdown", key]) });
          },
          changed: (recordIds) => {
            notifyOwnerNative(input.owner, recordIds);
            for (const listener of listeners) listener({ ...input.owner, ...(recordIds && { recordIds }) });
          },
        }),
      };
    },
    openTextDocument(input: { owner: StorageOwner; fileId: string }) {
      input = { ...input, owner: canonicalOwner(input.owner) };
      return createTextDocumentStorage({
        owner: input.owner,
        store: { transaction: transactionFor(JSON.stringify(["text-file", input.fileId])) },
      });
    },
    openNativeTextDocument(input: { owner: StorageOwner; fileId: string }) {
      input = { ...input, owner: canonicalOwner(input.owner) };
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
