import * as Y from "yjs";
import type { DocumentStore, StorageOwner } from "../shared";
import { writeText } from "./write-text";

/** A declared text file has its own document, including when it has no line breaks yet. */
export const createTextDocumentStorage = (input: { owner: StorageOwner; store: DocumentStore }) => {
  const { owner, store } = input;
  return {
    read: () => store.transaction(owner, async ({ document }) => document.getText("content").toString()),
    save: (value: string) =>
      store.transaction(owner, async ({ document }) => {
        document.transact(() => writeText(document.getText("content"), value));
      }),
    exportUpdate: () => store.transaction(owner, async ({ document }) => Y.encodeStateAsUpdate(document)),
    applyUpdate: (update: Uint8Array) =>
      store.transaction(owner, async ({ document }) => {
        Y.applyUpdate(document, update);
      }),
  };
};
