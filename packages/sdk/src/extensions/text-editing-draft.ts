import * as Y from "yjs";
import { textEditingError } from "./text-editing-codec";
import type { TextEditingDraft } from "./text-editing-types";

/** Preserve the original causal history until a frozen authored delta is acknowledged. */
export const createTextEditingDraft = (input: {
  state: Uint8Array;
  commit: (source: Uint8Array, update: Uint8Array, memberId: string, admitted: () => void) => Promise<void>;
  finished: () => void;
  cancelled?: () => void;
}) => {
  const document = new Y.Doc({ gc: false });
  Y.applyUpdate(document, input.state);
  const original = Y.encodeStateAsUpdate(document);
  const vector = Y.encodeStateVector(document);
  const memberId = crypto.randomUUID();
  let changed = false;
  let frozen = false;
  let done = false;
  let refused = false;
  let uncertain = false;
  let update: Uint8Array | undefined;
  let work: Promise<void> | undefined;
  document.on("update", () => {
    changed = true;
  });
  const finish = () => {
    if (done) return;
    done = true;
    input.finished();
    document.destroy();
  };
  const draft: TextEditingDraft = {
    text: document.getText("content"),
    commit() {
      if (done) return Promise.resolve();
      if (work) return work;
      frozen = true;
      refused = false;
      update ??= Y.encodeStateAsUpdate(document, vector);
      work = input
        .commit(original, update, memberId, finish)
        .then(finish)
        .catch((error: unknown) => {
          if (done) throw error;
          const failure = textEditingError(error);
          // A read-only refusal precedes admission. It cannot settle an earlier lost acknowledgement.
          refused =
            failure.code === "source_retired" ||
            (!uncertain && failure.code === "source_read_only" && !failure.retryable);
          if (!refused) uncertain = true;
          throw error;
        })
        .finally(() => {
          work = undefined;
        });
      return work;
    },
    cancel() {
      if (done) return false;
      if ((!frozen || refused) && !work) {
        input.cancelled?.();
        finish();
        return true;
      }
      return false;
    },
  };
  return { draft, pending: () => !done && (changed || frozen), frozen: () => frozen };
};
