import { isEmptyDocument, NativeSourcePendingError, type StorageOwner } from "pstdio-sync";
import {
  createTextDocumentStorage,
  mergeTextDocuments,
  prepareTextDocumentAdoption,
  readTextDocumentSeed,
  saveTextDocument,
  seedTextDocument,
  validateTextEditorState,
} from "pstdio-sync/text";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import type { DocumentTransactions } from "./document-transactions";
import { readNativeTextSnapshot } from "./native-text-snapshot";
import { orderedNativeRevision, orderedNativeSnapshot } from "./ordered-native-field";

const readNativeText = async (document: Y.Doc) => {
  if (isEmptyDocument(document)) throw new NativeSourcePendingError();
  await readTextDocumentSeed(document);
  return document.getText("content").toString();
};

export const createNativeDocumentStore = (
  db: DbClient,
  documentId: string,
  transactionFor: DocumentTransactions,
  revision: (owner: StorageOwner) => Promise<number>,
) => ({
  transaction: transactionFor(documentId),
  revision: async (owner: StorageOwner) =>
    (await orderedNativeRevision(db, owner, (JSON.parse(documentId) as string[])[1]!)) ?? revision(owner),
  initialHistory: {
    validate: readTextDocumentSeed,
    prepare: (owner: StorageOwner, remote: Y.Doc) =>
      transactionFor(documentId)(owner, async ({ document }) => prepareTextDocumentAdoption(document, remote)),
    merge: (owner: StorageOwner, remote: Y.Doc) => {
      let waiting = false;
      return transactionFor(documentId, async (local) => {
        if (isEmptyDocument(local)) return mergeTextDocuments(local, remote);
        const candidate = await prepareTextDocumentAdoption(local, remote);
        if (candidate) {
          candidate.destroy();
          waiting = true;
          return local;
        }
        const localSeed = await readTextDocumentSeed(local);
        const remoteSeed = await readTextDocumentSeed(remote);
        if (localSeed.id !== remoteSeed.id) {
          return mergeTextDocuments(local, remote);
        }
        Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));
        return local;
      })(owner, async ({ document }) => {
        if (waiting) return null;
        const snapshot = new Y.Doc();
        Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(document));
        return snapshot;
      });
    },
  },
});

export const openNativeDocument = (
  input: { owner: StorageOwner; fileId: string },
  deps: {
    db: DbClient;
    transactionFor: DocumentTransactions;
    nativeStore: (id: string) => ReturnType<typeof createNativeDocumentStore>;
    watch(owner: StorageOwner, id: string, listener: (change?: { recordIds?: readonly string[] }) => void): () => void;
  },
) => {
  const { db, transactionFor, nativeStore } = deps;
  const documentId = JSON.stringify(["native-markdown", input.fileId]);
  const store = nativeStore(documentId);
  const text = createTextDocumentStorage({ owner: input.owner, store });
  return {
    read: () => store.transaction(input.owner, ({ document }) => readNativeText(document)),
    exportUpdate: text.exportUpdate,
    snapshot: async () =>
      (await orderedNativeSnapshot(db, input.owner, input.fileId)) ?? {
        ...(await readNativeTextSnapshot(db, input.owner, documentId)),
        generation: undefined as string | undefined,
      },
    store,
    save: (source: string) =>
      store.transaction(input.owner, async ({ document }) => saveTextDocument(document, source)),
    seed: (source: string) =>
      store.transaction(input.owner, async ({ document }) => seedTextDocument(document, source)),
    async applySource(source: Y.Doc, admission?: { generation?: string }) {
      const snapshot = new Y.Doc();
      try {
        Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(source));
        await validateTextEditorState(Y.encodeStateAsUpdate(snapshot));
        await transactionFor(
          documentId,
          async (canonical) => {
            if (isEmptyDocument(canonical)) return mergeTextDocuments(canonical, snapshot);
            // The host accepts this room's edits into its current root. Relay publication
            // still uses initialHistory's CAS to serialize adoption across hosts.
            const candidate = await prepareTextDocumentAdoption(snapshot, canonical);
            if (candidate) return candidate;
            const sourceSeed = await readTextDocumentSeed(snapshot);
            const canonicalSeed = await readTextDocumentSeed(canonical);
            if (sourceSeed.id === canonicalSeed.id)
              Y.applyUpdate(canonical, Y.encodeStateAsUpdate(snapshot, Y.encodeStateVector(canonical)));
            return canonical;
          },
          { external: true, generation: admission?.generation },
        )(input.owner, async () => {});
      } finally {
        snapshot.destroy();
      }
    },
    watch: (listener: (change?: { recordIds?: readonly string[] }) => void) =>
      deps.watch(input.owner, documentId, listener),
  };
};
