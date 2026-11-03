import { NativeSourcePendingError, type StorageOwner } from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { lockStorageProject } from "./native-record-projection";
import { loadResourceDocuments } from "./resource-document-persistence";

/** The projection fence and the exact state it describes come from one locked snapshot. */
export const readNativeTextSnapshot = (db: DbClient, owner: StorageOwner, documentId: string) =>
  db.transaction(async (tx) => {
    await lockStorageProject(tx, owner.workbenchId);
    const { sources } = await loadResourceDocuments(tx, owner, [documentId]);
    const saved = sources.get(documentId);
    if (!saved) throw new NativeSourcePendingError();
    return { state: Y.mergeUpdates(saved.states), revision: saved.revision };
  });
