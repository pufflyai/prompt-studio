import { fingerprint, type StorageRecord } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { captureCheckpoint } from "./checkpoint-capture";
import { migrationAuthor } from "./document-author";
import { applyDocumentEdit } from "./document-edits";
import { readDocumentRecord } from "./document-record";
import type { DocumentStore } from "./document-types";
import { validateDocumentGroup } from "./document-validation";
import { createMemoryRecordQueries } from "./memory-record-queries";
import type { AssetStore, GroupCommit, ResolutionCommit, StorageOwner } from "./types";

const outcome = (operationId: string) => ({
  operationId,
  state: "saved-locally" as const,
  status: "saved-locally" as const,
});

/** The record operations available while a transaction holds the owner lock. */
export interface LockedRecords {
  read(id: string): Promise<StorageRecord>;
  commit(group: GroupCommit): Promise<{ operationId: string; state: "saved-locally"; status: "saved-locally" }>;
}

export const createDocumentStorage = (input: { owner: StorageOwner; store: DocumentStore; assets?: AssetStore }) => {
  const { owner, store } = input;
  const observed = async (document: Y.Doc, id: string) => {
    const record = await readDocumentRecord(document, id);
    store.observer?.read(owner, record);
    return record;
  };
  return {
    dataVersion: (scope: string) =>
      store.transaction(owner, async ({ document }) => {
        const prefix = `${JSON.stringify([scope]).slice(0, -1)},`;
        const versions = [...document.getMap("data-migrations").keys()].filter((key) => key.startsWith(prefix));
        return Math.max(0, ...versions.map((key) => (JSON.parse(key) as [string, number])[1]));
      }),
    setDataVersion: (scope: string, version: number) =>
      store.transaction(owner, async ({ document }) => {
        document.getMap("data-migrations").set(JSON.stringify([scope, version]), true);
      }),
    exportUpdate: () => store.transaction(owner, async ({ document }) => Y.encodeStateAsUpdate(document)),
    applyUpdate: (update: Uint8Array) =>
      store.transaction(owner, async ({ document }) => {
        Y.applyUpdate(document, update);
      }),
    capture: async <T>(action: (store: DocumentStore) => Promise<T>) => {
      const update = await store.transaction(owner, async ({ document }) => Y.encodeStateAsUpdate(document));
      const snapshot = new Y.Doc();
      Y.applyUpdate(snapshot, update);
      // Handlers may stage assets in the same database. Release its lock before running them.
      try {
        return await captureCheckpoint(snapshot, owner, action, store.observer);
      } finally {
        snapshot.destroy();
      }
    },
    records: {
      ...(store.queries?.(owner) ?? createMemoryRecordQueries(owner, store)),
      /** Reads and commits inside one owner lock, for read-modify-write callers. */
      transaction: <T>(run: (records: LockedRecords) => Promise<T>) =>
        store.transaction(owner, (state) =>
          run(
            createDocumentStorage({
              ...input,
              store: { transaction: async (_owner, action) => action(state), observer: store.observer },
            }).records,
          ),
        ),
      read: (id: string, _branch?: { operationId: string }) =>
        store.transaction(owner, async ({ document }) => observed(document, id)),
      list: (prefix = "") =>
        store.transaction(owner, async ({ document }) =>
          Promise.all(
            [...document.getMap("records").keys()]
              .filter((id) => id.startsWith(prefix))
              .sort()
              .map((id) => observed(document, id)),
          ),
        ),
      outcome: (id: string) =>
        store.transaction(owner, async (state) => ((await state.operation(id)) ? outcome(id) : undefined)),
      conflicts: async () => [] as import("pstdio-sync-contracts").StorageConflict[],
      inspect: (_id: string) =>
        Promise.reject<import("pstdio-sync-contracts").StorageConflictInspection>(
          new Error("Records merge automatically; there are no conflicts to inspect"),
        ),
      resolve: (_proposal: ResolutionCommit) =>
        Promise.reject<import("pstdio-sync-contracts").StorageSaveOutcome>(
          new Error("Records merge automatically; there are no conflicts to resolve"),
        ),
      commit: async (group: GroupCommit) => {
        if (!group.edits.length) throw new Error("Empty storage commit");
        const assets = group.edits.flatMap((edit) => (edit.asset ? [edit.asset] : []));
        if (assets.length) {
          if (!input.assets) throw new Error("Asset verification is unavailable");
          await input.assets.verifyComplete(assets);
        }
        const identity = await fingerprint(group.edits.map(({ expectedRevision: _revision, ...edit }) => edit));
        const saved = await store.transaction(owner, async (state) => {
          const doc = state.document;
          const previous = await state.operation(group.operationId);
          if (previous !== undefined && previous !== identity)
            throw new Error("Operation identity reused with changed payload");
          if (previous === undefined) {
            validateDocumentGroup(doc, group);
            const author = migrationAuthor(doc, state.migrationSeed, state.migrationHistory);
            doc.transact(() => {
              for (const edit of group.edits) applyDocumentEdit(doc, edit, author);
            });
          }
          state.remember(group.operationId, identity);
          return Promise.all(group.edits.map((edit) => readDocumentRecord(doc, edit.recordId)));
        });
        const result = outcome(group.operationId);
        store.observer?.committed(owner, saved, result);
        return result;
      },
    },
  };
};
