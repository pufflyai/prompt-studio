import { isEmptyDocument, NativeSourcePendingError, type StorageOwner } from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { assertStorageOwnerAdmitted } from "../../db/storage-admission";
import { lockStorageProject } from "./native-record-projection";
import { loadResourceDocuments } from "./resource-document-persistence";

/** The projection fence and the exact state it describes come from one locked snapshot. */
export const readNativeTextSnapshot = async (db: DbClient, owner: StorageOwner, documentId: string) => {
  assertStorageOwnerAdmitted(db, owner);
  return db.transaction(async (tx) => {
    await lockStorageProject(tx, owner.workbenchId);
    const { sources } = await loadResourceDocuments(tx, owner, [documentId]);
    const saved = sources.get(documentId);
    if (!saved) throw new NativeSourcePendingError();
    const state = Y.mergeUpdates(saved.states);
    const document = new Y.Doc();
    try {
      Y.applyUpdate(document, state);
      // A registration may own projection intents before canonical text has arrived.
      if (isEmptyDocument(document)) throw new NativeSourcePendingError();
    } finally {
      document.destroy();
    }
    return { state, revision: saved.revision };
  });
};
