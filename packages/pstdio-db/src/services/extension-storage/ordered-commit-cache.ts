import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedRecord } from "pstdio-sync/records";
import type { DbClient } from "../../db/connection.pglite";
import { storage_ordered_owners as owners, storage_record_projections as projections } from "../../db/schemas.pg";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

type Entry = { owner: string; version: string; ids: Set<string>; views: Map<string, OrderedRecord> };
// One group per database, shared by command-scoped facades; no per-record/owner accumulation.
const contexts = new WeakMap<DbClient, Entry>();

/** Retain only the last authored group's computed view. The SQL projection revision
 * and relay cursor invalidate it after another writer, admission, restore or reset. */
export const createOrderedCommitCache = (db: DbClient, owner: StorageOwner) => {
  const address = JSON.stringify([owner.workbenchId, owner.extensionId]);
  const version = async (tx: OrderedTransaction) => {
    const [row] = await tx
      .select({ revision: projections.revision, epoch: owners.epoch, after: owners.after })
      .from(projections)
      .innerJoin(
        owners,
        and(eq(owners.workbench_id, projections.workbench_id), eq(owners.extension_id, projections.extension_id)),
      )
      .where(orderedOwnerWhere(projections, owner));
    return row ? JSON.stringify(row) : undefined;
  };
  return {
    async read(tx: OrderedTransaction, ids: string[]) {
      const cached = contexts.get(db);
      if (!cached || cached.owner !== address || ids.some((id) => !cached.ids.has(id))) return;
      if (cached.version !== (await version(tx))) {
        contexts.delete(db);
        return;
      }
      return { views: new Map(cached.views), events: [] };
    },
    async stage(
      tx: OrderedTransaction,
      ids: string[],
      before: ReadonlyMap<string, OrderedRecord>,
      projected: OrderedRecord[],
      saved: { views?: ReadonlyMap<string, OrderedRecord>; records: unknown[] },
    ) {
      if (owner.extensionId === coreOwnerId) return;
      const views =
        saved.views ?? new Map([...before, ...projected.map((record) => [record.recordId, record] as const)]);
      const selected = new Map(ids.flatMap((id) => (views.has(id) ? [[id, views.get(id)!] as const] : [])));
      // Native causal state has its own lifecycle. Keep it on the full replay path.
      if ([...selected.values()].some((record) => Object.keys(record.texts ?? {}).length)) return;
      const current = await version(tx);
      return current ? { owner: address, version: current, ids: new Set(ids), views: selected } : undefined;
    },
    // Publish only after the owning SQL transaction commits, including callback batches.
    committed(entry: Entry | undefined) {
      if (entry) contexts.set(db, entry);
      else contexts.delete(db);
    },
  };
};
