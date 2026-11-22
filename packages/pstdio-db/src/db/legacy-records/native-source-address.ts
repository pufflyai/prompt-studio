import { createNativeSourceKey } from "pstdio-api-contracts";
import { NativeSourcePendingError, NativeSourceRetiredError, type StorageOwner } from "pstdio-sync";
import { hasEarlierRecordLifetime, recordLifetime } from "pstdio-sync/records";
import * as Y from "yjs";
import {
  loadResourceDocuments,
  resourceDocumentId,
} from "../../services/extension-storage/resource-document-persistence";
import type { DbClient } from "../connection.pglite";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** Call while holding the record owner lock; initial independent histories share their original key. */
export const nativeSourceAddressIn = async (
  tx: Transaction,
  owner: StorageOwner,
  input: { recordId: string; documentKey: string; field?: string },
) => {
  const id = resourceDocumentId(input.recordId);
  const { sources } = await loadResourceDocuments(tx, owner, [id]);
  const saved = sources.get(id);
  if (!saved) throw new NativeSourcePendingError();
  const document = new Y.Doc();
  try {
    for (const state of saved.states) Y.applyUpdate(document, state);
    if (!document.getMap("records").has(input.recordId) || document.getMap("deleted").has(input.recordId))
      throw new NativeSourceRetiredError(input.recordId);
    const lifetime = hasEarlierRecordLifetime(document, input.recordId)
      ? recordLifetime(document, input.recordId)
      : "initial";
    return {
      lifetime,
      documentKey: lifetime === "initial" ? input.documentKey : createNativeSourceKey([input.documentKey, lifetime]),
      generation: undefined as string | undefined,
    };
  } finally {
    document.destroy();
  }
};
