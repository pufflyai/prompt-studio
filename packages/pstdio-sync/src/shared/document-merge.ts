import * as Y from "yjs";

export const cloneDocument = (document: Y.Doc) => {
  const copy = new Y.Doc();
  try {
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(document));
    return copy;
  } catch (error) {
    copy.destroy();
    throw error;
  }
};

// A state vector cannot describe deletions. Applying the diff to a disposable copy also detects
// missing tombstones, without repeatedly sending delete sets the other document already holds.
export const missingUpdate = (source: Y.Doc, target: Y.Doc) => {
  const update = Y.encodeStateAsUpdate(source, Y.encodeStateVector(target));
  const copy = cloneDocument(target);
  let changed = false;
  copy.on("update", () => {
    changed = true;
  });
  try {
    Y.applyUpdate(copy, update);
    return changed ? update : null;
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
