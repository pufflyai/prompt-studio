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
import { createDocumentCheckpoints, readDocumentSnapshot } from "./document-checkpoints";
import { foldEvery } from "./document-persistence";
import { createDocumentAdmission, transactPreparedDocument } from "./document-transaction";

export const createDocumentStorageDBService = (db: DbClient, observer?: StorageObserver) => {
  const cache = createDocumentCache();
  const admit = createDocumentAdmission();
  const checkpoints = createDocumentCheckpoints(db);
  const listeners = new Set<(owner: StorageOwner) => void>();
  let environment: ReturnType<ReturnType<typeof createEnvironmentDBService>["get"]> | undefined;
  const getEnvironment = () => (environment ??= createEnvironmentDBService(db).get());
  const transactionFor = (documentId: string) => {
    const transaction: DocumentStore["transaction"] = async (owner, action) => {
      const { environmentId } = await getEnvironment();
      const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: documentId };
      const key = JSON.stringify(address);
      return admit(key, async () => {
        const result = await transactPreparedDocument(db, { address, owner, environmentId, cache }, action);
        cache.publish(key, result);
        if (result.changed) for (const listener of listeners) listener(owner);
        if (result.revision - result.foldedRevision >= foldEvery) checkpoints.schedule(address, result);
        return result.value;
      });
    };
    return transaction;
  };
  const transaction = transactionFor("records");
  const snapshotFor =
    (documentId: string): NonNullable<DocumentStore["snapshot"]> =>
    async (owner, knownRevision) => {
      const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: documentId };
      let snapshot = await readDocumentSnapshot(db, address, knownRevision);
      if (!snapshot) {
        await transactionFor(documentId)(owner, async () => {});
        snapshot = await readDocumentSnapshot(db, address);
      }
      return snapshot!;
    };
  const snapshot = snapshotFor("records");
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
    if (row) return row.revision;
    await transactionFor(documentId)(owner, async () => {});
    return (await snapshotFor(documentId)(owner)).revision;
  };
  const receiveFor =
    (documentId: string) => (owner: StorageOwner, expected: number, update: Uint8Array, signal?: AbortSignal) =>
      transactionFor(documentId)(owner, async (state) => {
        signal?.throwIfAborted();
        if (state.revision !== expected) return false;
        state.applyUpdate!(update);
        return true;
      });
  const revision = revisionFor("records");
  const receive = receiveFor("records");
  return {
    transaction,
    snapshot,
    revision,
    receive,
    flushCheckpoints: checkpoints.flush,
    observer,
    getEnvironment,
    documents: {
      open: (documentId: string) => ({
        transaction: transactionFor(documentId),
        snapshot: snapshotFor(documentId),
        revision: revisionFor(documentId),
        receive: receiveFor(documentId),
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
      return createDocumentStorage({ ...input, store: { transaction, snapshot, revision, receive, observer } });
    },
    openTextDocument(input: { owner: StorageOwner; fileId: string }) {
      return createTextDocumentStorage({
        owner: input.owner,
        store: {
          transaction: transactionFor(JSON.stringify(["text-file", input.fileId])),
          snapshot: snapshotFor(JSON.stringify(["text-file", input.fileId])),
        },
      });
    },
  };
};
