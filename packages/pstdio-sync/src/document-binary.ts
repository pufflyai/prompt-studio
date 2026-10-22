import * as Y from "yjs";

interface BinaryDocument {
  revision: number;
  foldedRevision: number;
  state?: Uint8Array[];
  updates: Uint8Array[];
}

const documents = new WeakMap<Y.Doc, BinaryDocument>();

/** Keep the original wire identities without re-encoding every named root. */
export const trackDocumentBinary = (document: Y.Doc, state?: Uint8Array | Uint8Array[]) => {
  const existing = documents.get(document);
  if (existing) return existing;
  const entry: BinaryDocument = {
    revision: 0,
    foldedRevision: 0,
    state: state instanceof Uint8Array ? [state] : state,
    updates: [],
  };
  documents.set(document, entry);
  document.on("update", (update: Uint8Array) => {
    entry.revision++;
    // Without a supplied checkpoint, the first export includes all prior content.
    if (entry.state) entry.updates.push(update);
  });
  return entry;
};

export const documentRevision = (document: Y.Doc) => trackDocumentBinary(document).revision;

export const applyDocumentBinaryUpdate = (document: Y.Doc, update: Uint8Array) => {
  const entry = trackDocumentBinary(document);
  Y.applyUpdate(document, update);
  // Materialized changes also emit an event. Retaining the original bytes includes
  // any causal gaps that did not materialize and therefore emitted no event.
  entry.revision++;
  if (entry.state) entry.updates.push(update);
};

export const snapshotDocumentBinary = (document: Y.Doc) => {
  const entry = trackDocumentBinary(document);
  if (!entry.state) {
    entry.state = [Y.encodeStateAsUpdate(document)];
    entry.foldedRevision = entry.revision;
  }
  return { revision: entry.revision, updates: [...entry.state, ...entry.updates] };
};

export const acceptDocumentCheckpoint = (document: Y.Doc, revision: number, state: Uint8Array) => {
  const entry = trackDocumentBinary(document);
  if (revision < entry.foldedRevision) return;
  entry.updates = entry.updates.slice(revision - entry.foldedRevision);
  entry.state = [state];
  entry.foldedRevision = revision;
};

export const exportDocumentBinary = (document: Y.Doc) => {
  const entry = trackDocumentBinary(document);
  const snapshot = snapshotDocumentBinary(document);
  if (snapshot.updates.length > 1) {
    acceptDocumentCheckpoint(document, snapshot.revision, Y.mergeUpdates(snapshot.updates));
  }
  return entry.state![0];
};
