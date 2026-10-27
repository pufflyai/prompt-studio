import * as Y from "yjs";
import { deterministicAuthors, migrationAuthor } from "./document-author";
import { applyDocumentEdit, recordTypeName } from "./document-edits";
import { type DocumentHistory, documentHistory } from "./document-history";
import { readDocumentRecord } from "./document-record";
import { validateDocumentGroup } from "./document-validation";
import { readValue } from "./document-values";
import { adoptNativeRecordSources, resetRecreatedNativeSource } from "./native-record-source";
import { adoptionEdit } from "./record-adoption";
import type { GroupCommit } from "./types";

const loadResourceDocument = (states: Uint8Array[]) => {
  const document = new Y.Doc();
  if (states.length)
    document.transact(() => {
      for (const state of states) Y.applyUpdate(document, state);
    });
  return document;
};

/** The data migration a save runs in. Its edits use deterministic authors, so devices agree (R44). */
export interface ResourceMigration {
  key: string;
  /** Each document's history when the migration first touched it, keyed by `document`. */
  histories: Map<string, DocumentHistory>;
  document: string;
}

/** Each record is its own Yjs document. This applies one record's edit to its saved state. */
export const editResourceDocument = async (
  states: Uint8Array[],
  edit: GroupCommit["edits"][number],
  checkpoint: boolean,
  migration?: ResourceMigration,
) => {
  const document = loadResourceDocument(states);
  try {
    validateDocumentGroup(document, { operationId: "validate", edits: [edit] });
    if (migration && !migration.histories.has(migration.document))
      migration.histories.set(migration.document, documentHistory(document));
    const author = migration && migrationAuthor(document, migration.key, migration.histories.get(migration.document));
    const updates: Uint8Array[] = [];
    document.on("update", (update: Uint8Array) => updates.push(update));
    document.transact(() => {
      resetRecreatedNativeSource(document, edit);
      applyDocumentEdit(document, edit, author);
    });
    return {
      checkpoint: checkpoint && updates.length ? Y.encodeStateAsUpdate(document) : null,
      update: updates.length ? Y.mergeUpdates(updates) : null,
      record: await readDocumentRecord(document, edit.recordId),
    };
  } finally {
    document.destroy();
  }
};

/** Merges updates another device made to one record. `update` is null when nothing was new here. */
export const mergeResourceDocument = async (
  recordId: string,
  states: Uint8Array[],
  incoming: Uint8Array[],
  options: { checkpoint: boolean; repair?: boolean },
) => {
  const document = loadResourceDocument(states);
  try {
    const updates: Uint8Array[] = [];
    document.on("update", (update: Uint8Array) => updates.push(update));
    document.transact(() => {
      for (const update of incoming) Y.applyUpdate(document, update);
    });
    return {
      checkpoint: options.checkpoint && updates.length ? Y.encodeStateAsUpdate(document) : null,
      update: updates.length ? Y.mergeUpdates(updates) : null,
      record: await readDocumentRecord(document, recordId),
      // What this device holds that an incoming latest state lacks, so the device can repair it (R19).
      missing: options.repair ? missingFrom(document, incoming) : null,
    };
  } finally {
    document.destroy();
  }
};

const missingFrom = (document: Y.Doc, states: Uint8Array[]) => {
  const other = loadResourceDocument(states);
  try {
    const update = Y.encodeStateAsUpdate(document, Y.encodeStateVector(other));
    let changed = false;
    other.on("update", () => {
      changed = true;
    });
    // A state vector cannot describe deletions; applying the diff detects missing tombstones too.
    Y.applyUpdate(other, update);
    return changed ? update : null;
  } finally {
    other.destroy();
  }
};

// Only a device's own edits prove a shared history. Every device that runs the same data migration
// writes with the same deterministic author, even on records whose histories are unrelated.
const sharesHistory = (local: Uint8Array[], remote: Y.Doc) => {
  const known = Y.decodeStateVector(Y.encodeStateVector(remote));
  return local.some((state) =>
    [...Y.decodeStateVector(Y.encodeStateVectorFromUpdate(state)).keys()].some(
      (client) => client < deterministicAuthors && known.has(client),
    ),
  );
};

/** Reads retained value history without making a deleted record visible again. */
export const retainedResourceValue = (recordId: string, states: Uint8Array[]) => {
  const document = loadResourceDocument(states);
  try {
    return readValue(document.getMap(recordTypeName(recordId)).get("value"), document);
  } finally {
    document.destroy();
  }
};

/** The full state of one saved record document, for a latest-state chunk. */
export const resourceDocumentState = (states: Uint8Array[]) =>
  states.length === 1 ? states[0]! : Y.mergeUpdates(states);

/**
 * Replaces this device's own history of a record with the synced one, then reapplies this
 * device's changes as a normal edit. Devices that moved the same record into its own document
 * separately have unrelated histories; merging those would duplicate text.
 */
export const adoptResourceDocument = async (
  recordId: string,
  remote: Uint8Array[],
  local: Uint8Array[],
  base: Uint8Array | undefined,
) => {
  const document = loadResourceDocument(remote);
  if (sharesHistory(local, document)) {
    // Histories already shared (for example after a reset cursor) merge as usual.
    try {
      for (const state of local) Y.applyUpdate(document, state);
      return {
        state: Y.encodeStateAsUpdate(document),
        update: missingFrom(document, remote),
        record: await readDocumentRecord(document, recordId),
      };
    } finally {
      document.destroy();
    }
  }
  const read = async (states: Uint8Array[]) => {
    const source = loadResourceDocument(states);
    try {
      return await readDocumentRecord(source, recordId);
    } finally {
      source.destroy();
    }
  };
  try {
    const localSource = loadResourceDocument(local);
    try {
      await adoptNativeRecordSources(localSource, document, recordId);
    } finally {
      localSource.destroy();
    }
    const edit = adoptionEdit(
      base && (await read([base])),
      await read(local),
      await readDocumentRecord(document, recordId),
    );
    if (edit) {
      validateDocumentGroup(document, { operationId: "adopt", edits: [edit] });
      document.transact(() => applyDocumentEdit(document, edit));
    }
    return {
      state: Y.encodeStateAsUpdate(document),
      update: missingFrom(document, remote),
      record: await readDocumentRecord(document, recordId),
    };
  } finally {
    document.destroy();
  }
};
