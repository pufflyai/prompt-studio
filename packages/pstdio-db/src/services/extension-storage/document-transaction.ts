import type { DocumentState, StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import type { createDocumentCache } from "./document-cache";
import {
  type DocumentAddress,
  DocumentPreparationChanged,
  prepareDocument,
  runDocumentTransaction,
} from "./document-persistence";
import type { StorageDiagnostics } from "./storage-diagnostics";

export const createDocumentAdmission = () => {
  const pending = new Map<string, Promise<unknown>>();
  return <T>(key: string, action: () => Promise<T>) => {
    const result = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
    pending.set(key, result);
    return result.finally(() => {
      if (pending.get(key) === result) pending.delete(key);
    });
  };
};

export const transactPreparedDocument = async <T>(
  db: DbClient,
  input: {
    address: DocumentAddress;
    owner: StorageOwner;
    environmentId: string;
    cache: ReturnType<typeof createDocumentCache>;
    diagnostics?: StorageDiagnostics;
  },
  action: (state: DocumentState) => Promise<T>,
) => {
  const { address, cache } = input;
  const key = JSON.stringify(address);
  let prepared = cache.get(key);
  for (;;) {
    prepared ??= await prepareDocument(db, input);
    try {
      const captured = prepared;
      const reused = captured.document === cache.get(key)?.document;
      return await db.transaction((tx) => {
        // Another owner's cache admission can evict this document while its DB turn waits.
        if (reused && cache.get(key)?.document !== captured.document) throw new DocumentPreparationChanged();
        return runDocumentTransaction(
          tx,
          { address, owner: input.owner, diagnostics: input.diagnostics, prepared: captured },
          action,
        );
      });
    } catch (error) {
      if (prepared.document !== cache.get(key)?.document) prepared.document.destroy();
      if (error instanceof DocumentPreparationChanged) {
        prepared = undefined;
        continue;
      }
      cache.discard(key);
      throw error;
    }
  }
};
