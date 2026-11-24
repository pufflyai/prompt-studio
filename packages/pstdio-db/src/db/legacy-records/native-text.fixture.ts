import type { DocumentStore, StorageOwner } from "pstdio-sync";
import { runDocumentTransaction } from "../../services/extension-storage/document-persistence";
import type { DocumentTransactions } from "../../services/extension-storage/document-transactions";
import {
  createNativeDocumentStore,
  openNativeDocument,
} from "../../services/extension-storage/native-document-storage";
import { loadResourceDocuments } from "../../services/extension-storage/resource-document-persistence";
import type { DbClient } from "../connection.pglite";
import { lockStorageProject, refreshNativeRecordText } from "./native-record-projection.fixture";

/** The released text path used only while constructing pre-admission input. */
export const openReleasedNativeText = (db: DbClient, owner: StorageOwner, key: string) => {
  const transactionFor: DocumentTransactions = (documentId, prepare) => {
    const transaction: DocumentStore["transaction"] = async (owner, action) => {
      const result = await db.transaction(async (tx) => {
        await lockStorageProject(tx, owner.workbenchId);
        const result = await runDocumentTransaction(
          tx,
          {
            owner,
            address: { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: documentId },
            prepare,
          },
          action,
        );
        if (result.changed)
          await refreshNativeRecordText(tx, owner, key, result.document.getText("content").toString());
        return result;
      });
      return result.value;
    };
    return transaction;
  };
  return openNativeDocument(
    { owner, fileId: key },
    {
      db,
      transactionFor,
      watch: () => () => {},
      nativeStore: (id) =>
        createNativeDocumentStore(
          db,
          id,
          transactionFor,
          async (owner) =>
            (await db.transaction((tx) => loadResourceDocuments(tx, owner, [id]))).sources.get(id)?.revision ?? 0,
        ),
    },
  );
};
