import { runBinaryTask } from "./binary-background";
import { exportDocumentBinary } from "./document-binary";
import { applyDocumentUpdate, type DocumentStore } from "./document-types";
import { writeText } from "./document-values";
import type { StorageOwner } from "./types";

/** A declared text file has its own document, including when it has no line breaks yet. */
export const createTextDocumentStorage = (input: { owner: StorageOwner; store: DocumentStore }) => {
  const { owner, store } = input;
  return {
    read: () => store.transaction(owner, async ({ document }) => document.getText("content").toString()),
    save: (value: string) =>
      store.transaction(owner, async ({ document }) => {
        document.transact(() => writeText(document.getText("content"), value));
      }),
    exportUpdate: async () => {
      if (store.snapshot) {
        return (
          await runBinaryTask(async () => ({ kind: "checkpoint", updates: (await store.snapshot!(owner)).updates }))
        ).state;
      }
      return store.transaction(owner, async ({ document }) => exportDocumentBinary(document).slice());
    },
    applyUpdate: (update: Uint8Array) =>
      store.transaction(owner, async (state) => {
        applyDocumentUpdate(state, update);
      }),
  };
};
