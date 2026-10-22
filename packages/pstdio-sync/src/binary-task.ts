import * as Y from "yjs";
import { binaryContains, binaryIsComplete } from "./binary-coverage";
import type { BinaryTask } from "./binary-task-types";
import { documentBlobManifest, validateDocumentBlobManifest } from "./relay/document-blob-manifest";
import { checkSummary } from "./relay/document-merge";

const compare = (task: Extract<BinaryTask, { kind: "compare" }>, remote: Y.Doc) => {
  const state = Y.mergeUpdates(task.local);
  const local = new Y.Doc();
  try {
    Y.applyUpdate(local, state);
    Y.applyUpdate(remote, task.remote);
    return {
      complete: binaryIsComplete([state], local),
      state,
      summary: Y.encodeStateVector(local),
      blobs: documentBlobManifest(local),
      update: binaryContains(task.remote, state) ? null : Y.diffUpdate(state, Y.encodeStateVector(remote)),
      rejected: [],
    };
  } finally {
    local.destroy();
  }
};
const receive = (task: Extract<BinaryTask, { kind: "receive" }>, document: Y.Doc) => {
  try {
    for (const update of task.local) Y.applyUpdate(document, update);
    const existing = new Set(documentBlobManifest(document).map(({ asset }) => JSON.stringify(asset)));
    Y.applyUpdate(document, task.update);
    if (!binaryIsComplete([task.update], document)) throw new Error("Missing causal predecessors");
    const blobs = documentBlobManifest(document);
    // Local assets may await encryption. Newly visible assets must already have
    // a relay reference; verify their bytes before accepting this revision.
    validateDocumentBlobManifest(
      blobs.filter(({ asset, reference }) => reference || !existing.has(JSON.stringify(asset))),
    );
    return { state: new Uint8Array([0, 0]), summary: new Uint8Array([0]), blobs, update: null, rejected: [] };
  } catch {
    return { state: new Uint8Array([0, 0]), summary: new Uint8Array([0]), blobs: [], update: null, rejected: [0] };
  }
};
const stage = (task: Extract<BinaryTask, { kind: "stage" }>, document: Y.Doc) => {
  Y.applyUpdate(document, task.base);
  if (!binaryIsComplete([task.base], document)) throw new Error("Relay state has missing causal predecessors");
  if (task.summary) checkSummary(document, task.summary);
  validateDocumentBlobManifest(documentBlobManifest(document));
  const accepted = [task.base];
  const rejected: number[] = [];
  let staged = document;
  try {
    for (const [index, update] of task.updates.entries()) {
      try {
        Y.applyUpdate(staged, update);
        if (!binaryIsComplete([update], staged)) throw new Error("Relay update has missing causal predecessors");
        validateDocumentBlobManifest(documentBlobManifest(staged));
        accepted.push(update);
      } catch {
        rejected.push(index);
        // Yjs cannot roll back a partly applied update. Rebuild only after rejection.
        if (staged !== document) staged.destroy();
        staged = new Y.Doc();
        for (const previous of accepted) Y.applyUpdate(staged, previous);
      }
    }
    return {
      state: Y.mergeUpdates(accepted),
      summary: Y.encodeStateVector(staged),
      blobs: documentBlobManifest(staged),
      update: accepted.length > 1 ? Y.mergeUpdates(accepted.slice(1)) : null,
      rejected,
    };
  } finally {
    if (staged !== document) staged.destroy();
  }
};

/** Runs on the background thread. Documents here never publish user-visible state. */
export const executeBinaryTask = (task: BinaryTask) => {
  if (task.kind === "checkpoint") {
    const state = Y.mergeUpdates(task.updates);
    return { state, summary: Y.encodeStateVectorFromUpdate(state), blobs: [], update: null, rejected: [] };
  }
  const document = new Y.Doc();
  try {
    if (task.kind === "compact") {
      for (const update of task.updates) Y.applyUpdate(document, update);
      // Encoding the garbage-collected document also retains pending structs and
      // delete sets. A binary merge alone keeps deleted content forever.
      const state = Y.encodeStateAsUpdate(document);
      return { state, summary: Y.encodeStateVector(document), blobs: [], update: null, rejected: [] };
    }
    if (task.kind === "compare") return compare(task, document);
    if (task.kind === "receive") return receive(task, document);
    return stage(task, document);
  } finally {
    document.destroy();
  }
};
