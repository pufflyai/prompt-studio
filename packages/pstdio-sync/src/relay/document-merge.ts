import * as Y from "yjs";
import { documentRevision, exportDocumentBinary, trackDocumentBinary } from "../document-binary";

export const cloneDocument = (document: Y.Doc) => {
  const copy = new Y.Doc();
  try {
    const update = exportDocumentBinary(document);
    Y.applyUpdate(copy, update);
    trackDocumentBinary(copy, update);
    return copy;
  } catch (error) {
    copy.destroy();
    throw error;
  }
};

// A state vector cannot describe deletions. Applying the diff to a disposable copy also detects
// missing tombstones, without repeatedly sending delete sets the other document already holds.
const comparisons = new WeakMap<Y.Doc, WeakMap<Y.Doc, { source: number; target: number; update: Uint8Array | null }>>();

export const missingUpdate = (source: Y.Doc, target: Y.Doc) => {
  const sourceRevision = documentRevision(source);
  const targetRevision = documentRevision(target);
  let targets = comparisons.get(source);
  if (!targets) {
    targets = new WeakMap();
    comparisons.set(source, targets);
  }
  const previous = targets.get(target);
  if (previous?.source === sourceRevision && previous.target === targetRevision) return previous.update;
  const update = Y.diffUpdate(exportDocumentBinary(source), Y.encodeStateVector(target));
  const copy = cloneDocument(target);
  let changed = false;
  copy.on("update", () => {
    changed = true;
  });
  try {
    Y.applyUpdate(copy, update);
    const result = changed ? update : null;
    targets.set(target, { source: sourceRevision, target: targetRevision, update: result });
    return result;
  } finally {
    copy.destroy();
  }
};

export const checkSummary = (document: Y.Doc, summary: Uint8Array) => {
  const expected = Y.decodeStateVector(Y.encodeStateVector(document));
  const actual = Y.decodeStateVector(summary);
  if (expected.size !== actual.size || [...expected].some(([client, clock]) => actual.get(client) !== clock))
    throw new Error("Latest state and edit summary disagree");
};
