import * as Y from "yjs";
import { applyDocumentEdit } from "./document-edits";
import { readDocumentRecord } from "./document-record";
import { validateDocumentGroup } from "./document-validation";
import type { GroupCommit } from "./types";

/** Each record is its own Yjs document. This applies one record's edit to its saved state. */
export const editResourceDocument = async (
  states: Uint8Array[],
  edit: GroupCommit["edits"][number],
  checkpoint: boolean,
) => {
  const document = new Y.Doc();
  try {
    // One transaction replays the tail without repeating cleanup for every update.
    if (states.length)
      document.transact(() => {
        for (const state of states) Y.applyUpdate(document, state);
      });
    validateDocumentGroup(document, { operationId: "validate", edits: [edit] });
    const updates: Uint8Array[] = [];
    document.on("update", (update: Uint8Array) => updates.push(update));
    document.transact(() => applyDocumentEdit(document, edit));
    return {
      checkpoint: checkpoint && updates.length ? Y.encodeStateAsUpdate(document) : null,
      update: updates.length ? Y.mergeUpdates(updates) : null,
      record: await readDocumentRecord(document, edit.recordId),
    };
  } finally {
    document.destroy();
  }
};
