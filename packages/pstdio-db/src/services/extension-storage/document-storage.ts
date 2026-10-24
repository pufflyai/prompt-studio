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
import { resourceDocumentId } from "./resource-document-persistence";
import { upgradeOwnerRecords } from "./resource-record-upgrade";
import { createResourceRecords } from "./resource-records";
import type { StorageDiagnostics } from "./storage-diagnostics";

export const createDocumentStorageDBService = (
  db: DbClient,
  observer?: StorageObserver,
  diagnostics?: StorageDiagnostics,
) => {
  const cache = createDocumentCache();
  const listeners = new Set<(owner: StorageOwner) => void>();
  const statistics = createProjectionStatistics(db);
  let environment: ReturnType<ReturnType<typeof createEnvironmentDBService>["get"]> | undefined;
  const getEnvironment = () => (environment ??= createEnvironmentDBService(db).get());
  const transactionFor = (documentId: string) => {
    const transaction: DocumentStore["transaction"] = async (owner, action) => {
      const { environmentId } = await getEnvironment();
      const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: documentId };
      const key = JSON.stringify(address);
      try {
        const result = await db.transaction((tx) =>
          runDocumentTransaction(tx, { address, owner, environmentId, cached: cache.get(key), diagnostics }, action),
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
  const upgrades = new Map<string, Promise<void>>();
  // Each owner's records move out of its owner document once per process, before any record operation.
  const upgrade = (owner: StorageOwner) => {
    const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: "records" };
    const key = JSON.stringify(address);
    let upgraded = upgrades.get(key);
    if (!upgraded) {
      // Loading the owner document first imports any journal data from before owner documents.
      upgraded = transaction(owner, async () => {})
        .then(() => upgradeOwnerRecords(db, owner))
        .then((moved) => {
          if (moved) cache.discard(key);
        });
      upgrades.set(key, upgraded);
      upgraded.catch(() => upgrades.delete(key));
    }
    return upgraded;
  };
  const isResourceDocument = (id: string) => id.startsWith(resourceDocumentId("").slice(0, -2));
  return {
    transaction,
    upgrade,
    observer,
    getEnvironment,
    flushStatistics: statistics.flush,
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
          for (const { id } of local)
            if (id !== "records" && !isResourceDocument(id) && !directory.has(id)) directory.set(id, true);
          return ["records", ...[...directory.keys()].filter((id) => id !== "records").sort()];
        });
      },
    },
    async hasData(owner: StorageOwner) {
      await upgrade(owner);
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
          upgrade: () => upgrade(input.owner),
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
  };
};
