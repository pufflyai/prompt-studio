import * as Y from "yjs";
import type { TextEditingDraft } from "./text-editing-types";

/** Preserve the original causal history until a frozen authored delta is acknowledged. */
export const createTextEditingDraft = (input: {
  state: Uint8Array;
  commit: (source: Uint8Array, update: Uint8Array, memberId: string) => Promise<void>;
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
  let retired = false;
  let update: Uint8Array | undefined;
  let work: Promise<void> | undefined;
  document.on("update", () => {
    changed = true;
  });
  const finish = () => {
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
      update ??= Y.encodeStateAsUpdate(document, vector);
      work = input
        .commit(original, update, memberId)
        .then(finish)
        .catch((error: unknown) => {
          retired = !!error && typeof error === "object" && "code" in error && error.code === "source_retired";
          throw error;
        })
        .finally(() => {
          work = undefined;
        });
      return work;
    },
    cancel() {
      if ((!frozen || retired) && !done) {
        input.cancelled?.();
        finish();
      }
    },
  };
  return { draft, pending: () => !done && (changed || frozen), frozen: () => frozen };
};
