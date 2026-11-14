import { canonicalOwner } from "pstdio-api-contracts/extension-host";
import type { DocumentState, DocumentStore, StorageOwner } from "pstdio-sync";
import type * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import type { createDocumentCache } from "./document-cache";
import type { createDocumentDirectory } from "./document-directory";
import { runDocumentTransaction } from "./document-persistence";
import { lockStorageProject, refreshNativeRecordText } from "./native-record-projection";
import { ensureOrderedOwner } from "./ordered-conversion";
import { readConversion } from "./ordered-conversion-state";
import { runOrderedNativeField } from "./ordered-native-field";
import type { OrderedTransaction } from "./ordered-sql";
import type { StorageDiagnostics } from "./storage-diagnostics";

export type DocumentTransactions = ReturnType<typeof createDocumentTransactions>;
class ConversionPending extends Error {}
const lockNativeFallback = async (tx: OrderedTransaction, owner: StorageOwner) => {
  await lockStorageProject(tx, owner.workbenchId);
  // Startup can claim the owner after the optimistic native probe. Release this
  // transaction before waiting for the conversion's own transactions.
  if (await readConversion(tx, owner)) throw new ConversionPending();
};
export const createDocumentTransactions = (
  db: DbClient,
  deps: {
    cache: ReturnType<typeof createDocumentCache>;
    diagnostics?: StorageDiagnostics;
    directory(): ReturnType<typeof createDocumentDirectory>;
    projected(count: number): void;
    published(owner: StorageOwner, documentId: string): void;
  },
) => {
  const native = async <T>(
    owner: StorageOwner,
    documentId: string,
    action: (state: DocumentState) => Promise<T>,
    prepare?: (document: Y.Doc) => Promise<Y.Doc>,
    admission?: { external?: boolean; generation?: string },
  ) => {
    if (!documentId.startsWith('["native-markdown",')) return undefined;
    const key = (JSON.parse(documentId) as string[])[1]!;
    const result = await runOrderedNativeField({ db, owner, key, action, prepare, ...admission });
    if (!result) return undefined;
    if (result.projected) deps.projected(result.projected);
    if (result.changed) deps.published(owner, documentId);
    return result;
  };
  return (
    documentId: string,
    prepare?: (document: Y.Doc) => Promise<Y.Doc>,
    admission?: { external?: boolean; generation?: string },
  ) => {
    const transaction: DocumentStore["transaction"] = async (owner, action) => {
      owner = canonicalOwner(owner);
      const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: documentId };
      const key = JSON.stringify(address);
      try {
        const ordered = await native(owner, documentId, action, prepare, admission);
        if (ordered) return ordered.value;
        const result = await db.transaction(async (tx) => {
          const nativeKey = documentId.startsWith('["native-markdown",')
            ? (JSON.parse(documentId) as string[])[1]
            : undefined;
          if (nativeKey) await lockNativeFallback(tx, owner);
          const result = await runDocumentTransaction(
            tx,
            { address, owner, cached: deps.cache.get(key), diagnostics: deps.diagnostics, prepare },
            action,
          );
          if (result.changed) await deps.directory().register(tx, owner, documentId);
          if (nativeKey && result.changed)
            await refreshNativeRecordText(tx, owner, nativeKey, result.document.getText("content").toString());
          return result;
        });
        deps.cache.publish(key, result);
        if (result.changed) deps.published(owner, documentId);
        return result.value;
      } catch (error) {
        deps.cache.discard(key);
        if (error instanceof ConversionPending) {
          await ensureOrderedOwner(db, owner);
          return transaction(owner, action);
        }
        throw error;
      }
    };
    return transaction;
  };
};
