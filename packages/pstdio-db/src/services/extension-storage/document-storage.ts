import { and, eq } from "drizzle-orm";
import {
  type AssetStore,
  createDocumentStorage,
  createTextDocumentStorage,
  type DocumentStore,
  hasDocumentUserData,
  isEmptyDocument,
  mergeTextDocuments,
  prepareTextDocumentAdoption,
  readTextDocumentSeed,
  type StorageObserver,
  type StorageOwner,
  saveTextDocument,
  seedTextDocument,
} from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records, storage_documents } from "../../db/schemas.pg";
import { createEnvironmentDBService } from "../environment/environment";
import { createDocumentCache } from "./document-cache";
import { runDocumentTransaction } from "./document-persistence";
import { createProjectionStatistics } from "./projection-statistics";
import { createRecordStreamStore } from "./record-stream-store";
import { resourceDocumentId } from "./resource-document-persistence";
import { createResourceRecords } from "./resource-records";
import type { StorageDiagnostics } from "./storage-diagnostics";

export const createDocumentStorageDBService = (
  db: DbClient,
  observer?: StorageObserver,
  diagnostics?: StorageDiagnostics,
) => {
  const cache = createDocumentCache();
  const listeners = new Set<(owner: StorageOwner) => void>();
  const documentListeners = new Map<string, Set<() => void>>();
  const addressFor = (owner: StorageOwner, documentId: string) => ({
    workbench_id: owner.workbenchId,
    extension_id: owner.extensionId,
    document_id: documentId,
  });
  const statistics = createProjectionStatistics(db);
  let environment: ReturnType<ReturnType<typeof createEnvironmentDBService>["get"]> | undefined;
  const getEnvironment = () => (environment ??= createEnvironmentDBService(db).get());
  const transactionFor = (documentId: string, prepare?: (document: Y.Doc) => Promise<Y.Doc>) => {
    const transaction: DocumentStore["transaction"] = async (owner, action) => {
      const address = addressFor(owner, documentId);
      const key = JSON.stringify(address);
      try {
        const result = await db.transaction((tx) =>
          runDocumentTransaction(tx, { address, owner, cached: cache.get(key), diagnostics, prepare }, action),
        );
        cache.publish(key, result);
        if (result.changed) {
          for (const listener of listeners) listener(owner);
          for (const listener of documentListeners.get(key) ?? []) listener();
        }
        return result.value;
      } catch (error) {
        cache.discard(key);
        throw error;
      }
    };
    return transaction;
  };
  const transaction = transactionFor("records");
  const nativeStore = (documentId: string) => ({
    transaction: transactionFor(documentId),
    initialHistory: {
      validate: readTextDocumentSeed,
      prepare: (owner: StorageOwner, remote: Y.Doc) =>
        transactionFor(documentId)(owner, async ({ document }) => prepareTextDocumentAdoption(document, remote)),
      merge: (owner: StorageOwner, remote: Y.Doc) => {
        let waiting = false;
        return transactionFor(documentId, async (local) => {
          if (isEmptyDocument(local)) return mergeTextDocuments(local, remote);
          const candidate = await prepareTextDocumentAdoption(local, remote);
          if (candidate) {
            candidate.destroy();
            waiting = true;
            return local;
          }
          const localSeed = await readTextDocumentSeed(local);
          const remoteSeed = await readTextDocumentSeed(remote);
          if (localSeed.id !== remoteSeed.id) {
            return mergeTextDocuments(local, remote);
          }
          Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));
          return local;
        })(owner, async ({ document }) => {
          if (waiting) return null;
          const snapshot = new Y.Doc();
          Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(document));
          return snapshot;
        });
      },
    },
  });
  const isResourceDocument = (id: string) => id.startsWith(resourceDocumentId("").slice(0, -2));
  return {
    transaction,
    observer,
    getEnvironment,
    flushStatistics: statistics.flush,
    documents: {
      open: (documentId: string) =>
        documentId.startsWith('["native-markdown",')
          ? nativeStore(documentId)
          : { transaction: transactionFor(documentId) },
      recordStream: (owner: StorageOwner) =>
        createRecordStreamStore(db, owner, {
          statistics,
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
    openNativeTextDocument(input: { owner: StorageOwner; fileId: string }) {
      const documentId = JSON.stringify(["native-markdown", input.fileId]);
      const store = nativeStore(documentId);
      const text = createTextDocumentStorage({ owner: input.owner, store });
      return {
        read: text.read,
        exportUpdate: text.exportUpdate,
        store,
        save: (source: string) =>
          store.transaction(input.owner, async ({ document }) => saveTextDocument(document, source)),
        seed: (source: string) =>
          store.transaction(input.owner, async ({ document }) => seedTextDocument(document, source)),
        async applySource(source: Y.Doc) {
          const snapshot = new Y.Doc();
          try {
            Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(source));
            if (snapshot.store.pendingStructs || snapshot.store.pendingDs)
              throw new Error("The editor source is missing causal history");
            await readTextDocumentSeed(snapshot);
            await transactionFor(documentId, async (canonical) => {
              if (isEmptyDocument(canonical)) return mergeTextDocuments(canonical, snapshot);
              // The host accepts this room's edits into its current root. Relay publication
              // still uses initialHistory's CAS to serialize adoption across hosts.
              const candidate = await prepareTextDocumentAdoption(snapshot, canonical);
              if (candidate) return candidate;
              const sourceSeed = await readTextDocumentSeed(snapshot);
              const canonicalSeed = await readTextDocumentSeed(canonical);
              if (sourceSeed.id === canonicalSeed.id)
                Y.applyUpdate(canonical, Y.encodeStateAsUpdate(snapshot, Y.encodeStateVector(canonical)));
              return canonical;
            })(input.owner, async () => {});
          } finally {
            snapshot.destroy();
          }
        },
        watch(listener: () => void) {
          const key = JSON.stringify(addressFor(input.owner, documentId));
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
      };
    },
  };
};
