import { and, eq } from "drizzle-orm";
import { type AssetStore, editResourceDocument, type StorageObserver, type StorageOwner } from "pstdio-sync";
import {
  assertStorageLimits,
  fingerprint,
  type StorageConflict,
  type StorageConflictInspection,
  type StorageGroup,
  type StorageSaveOutcome,
} from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_document_operations } from "../../db/schemas.pg";
import { dataMigrationContext } from "./data-migration-context";
import type { createProjectionStatistics } from "./projection-statistics";
import { lockRecordOwner, saveRecordChanges } from "./record-changes";
import { queueRecordUpload } from "./record-outbox";
import { createRecordQueries, listProjectedRecords, readProjectedRecords } from "./record-queries";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";
import type { StorageDiagnostics } from "./storage-diagnostics";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
// A record's update tail folds into its checkpoint after this many updates.
export const resourceFoldEvery = 128;

const outcome = (operationId: string) => ({
  operationId,
  state: "saved-locally" as const,
  status: "saved-locally" as const,
});

/** Records of one owner. Each record is its own Yjs document; reads use the SQL projection. */
export const createResourceRecords = (
  db: DbClient,
  owner: StorageOwner,
  deps: {
    /** Resolves once the owner's records no longer live in its owner document. */
    statistics: ReturnType<typeof createProjectionStatistics>;
    /** Notifies owner watchers after a commit. */
    changed: () => void;
    observer?: StorageObserver;
    assets?: AssetStore;
    diagnostics?: StorageDiagnostics;
  },
) => {
  const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: "records" };
  const queries = createRecordQueries(db, owner, deps.diagnostics);
  const receipt = (tx: Pick<DbClient, "select">, operationId: string) =>
    tx
      .select({ fingerprint: storage_document_operations.fingerprint })
      .from(storage_document_operations)
      .where(
        and(
          eq(storage_document_operations.workbench_id, owner.workbenchId),
          eq(storage_document_operations.extension_id, owner.extensionId),
          eq(storage_document_operations.document_id, "records"),
          eq(storage_document_operations.operation_id, operationId),
        ),
      );
  const commitIn = async (tx: Transaction, group: StorageGroup, identity: string) => {
    const revision = await lockRecordOwner(tx, owner);
    const ids = group.edits.map(({ recordId }) => recordId);
    const [previous] = await receipt(tx, group.operationId);
    if (previous) {
      if (previous.fingerprint !== identity) throw new Error("Operation identity reused with changed payload");
      return { records: await readProjectedRecords(tx, owner, ids), projected: 0 };
    }
    const { sources } = await loadResourceDocuments(tx, owner, ids.map(resourceDocumentId));
    const migration = dataMigrationContext.getStore();
    // Every edit is validated and prepared before anything is written; a failure aborts the whole group.
    const prepared = await Promise.all(
      group.edits.map(async (edit) => {
        const id = resourceDocumentId(edit.recordId);
        const saved = sources.get(id);
        const next = (saved?.revision ?? 0) + 1;
        const foldedRevision = saved?.folded_revision ?? 0;
        const checkpoint = !saved || next - foldedRevision >= resourceFoldEvery;
        const result = await editResourceDocument(
          saved?.states ?? [],
          edit,
          checkpoint,
          migration && { ...migration, document: JSON.stringify([owner.workbenchId, owner.extensionId, id]) },
        );
        return { id, revision: next, foldedRevision, ...result };
      }),
    );
    const records = prepared.map((value) => value.record);
    assertStorageLimits(records);
    const projected = await saveRecordChanges(tx, owner, revision, prepared);
    await queueRecordUpload(tx, owner, prepared);
    await tx
      .insert(storage_document_operations)
      .values({ ...address, operation_id: group.operationId, fingerprint: identity });
    return { records, projected };
  };
  const prepare = async (group: StorageGroup) => {
    if (!group.operationId || !group.edits.length) throw new Error("Empty storage commit");
    const ids = group.edits.map(({ recordId }) => recordId);
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
      throw new Error("A commit must name each record once");
    const assets = group.edits.flatMap((edit) => (edit.asset ? [edit.asset] : []));
    if (assets.length) {
      if (!deps.assets) throw new Error("Asset verification is unavailable");
      await deps.assets.verifyComplete(assets);
    }
    return fingerprint(group.edits.map(({ expectedRevision: _revision, ...edit }) => edit));
  };
  const published = (
    result: { records: { recordId: string; revision: string }[]; projected: number },
    operationId: string,
  ) => {
    if (result.projected) deps.statistics.record(result.projected);
    deps.changed();
    const saved = outcome(operationId);
    deps.observer?.committed(owner, result.records, saved);
    return saved;
  };
  const read = async (connection: Pick<DbClient, "select">, id: string) => {
    const [record] = await readProjectedRecords(connection, owner, [id]);
    deps.observer?.read(owner, record);
    return record;
  };
  return {
    ...queries,
    readMany: async (ids: string[]) => {
      return queries.readMany(ids);
    },
    read: async (id: string, _branch?: { operationId: string }) => {
      return read(db, id);
    },
    list: async (prefix = "") => {
      const records = await listProjectedRecords(db, owner, prefix);
      for (const record of records) deps.observer?.read(owner, record);
      return records;
    },
    outcome: async (id: string) => {
      const [row] = await receipt(db, id);
      return row ? outcome(id) : undefined;
    },
    commit: async (group: StorageGroup) => {
      const identity = await prepare(group);
      return published(await db.transaction((tx) => commitIn(tx, group, identity)), group.operationId);
    },
    /** Reads and commits inside one owner lock, for read-modify-write callers. */
    transaction: async <T>(
      run: (records: {
        read: (id: string) => ReturnType<typeof read>;
        commit: (group: StorageGroup) => Promise<ReturnType<typeof outcome>>;
      }) => Promise<T>,
    ) => {
      const committed: { result: Awaited<ReturnType<typeof commitIn>>; operationId: string }[] = [];
      const value = await db.transaction(async (tx) => {
        await lockRecordOwner(tx, owner);
        return run({
          read: (id) => read(tx, id),
          commit: async (group) => {
            const result = await commitIn(tx, group, await prepare(group));
            committed.push({ result, operationId: group.operationId });
            return outcome(group.operationId);
          },
        });
      });
      for (const { result, operationId } of committed) published(result, operationId);
      return value;
    },
    conflicts: async () => [] as StorageConflict[],
    inspect: (_id: string) =>
      Promise.reject<StorageConflictInspection>(
        new Error("Records merge automatically; there are no conflicts to inspect"),
      ),
    resolve: (_proposal: unknown) =>
      Promise.reject<StorageSaveOutcome>(new Error("Records merge automatically; there are no conflicts to resolve")),
  };
};
