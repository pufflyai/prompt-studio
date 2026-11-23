import { and, inArray, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedRecord } from "pstdio-sync/records";
import { records } from "../../db/schemas.pg";
import { confirmedRecordBase, stableRecordColumns } from "./ordered-record-row";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { readCanonicalRecord, readRetainedRecord } from "./retained-records";

const dirty = new WeakMap<object, Map<string, Set<string>>>();
/** Savepoint bookkeeping follows SQL release/rollback together with the staged bodies. */
export const withOrderedRecordSavepoint = async <T>(
  tx: OrderedTransaction,
  run: (nested: OrderedTransaction) => Promise<T>,
) => {
  let released: Map<string, Set<string>> | undefined;
  const result = await tx.transaction(async (nested) => {
    const inherited = new Map([...(dirty.get(tx) ?? [])].map(([key, ids]) => [key, new Set(ids)]));
    dirty.set(nested, inherited);
    const result = await run(nested);
    released = dirty.get(nested)!;
    return result;
  });
  dirty.set(tx, released!);
  return result;
};
const ownerKey = (owner: StorageOwner) => JSON.stringify([owner.workbenchId, owner.extensionId]);
export const noteCanonicalRecordWrite = (tx: object, owner: StorageOwner, ids: string[]) => {
  let owners = dirty.get(tx);
  if (!owners) {
    owners = new Map();
    dirty.set(tx, owners);
  }
  const key = ownerKey(owner);
  let pending = owners.get(key);
  if (!pending) {
    pending = new Set();
    owners.set(key, pending);
  }
  for (const id of ids) pending.add(id);
};
export const noteRecordPublication = (tx: object, owner: StorageOwner, ids: string[]) => {
  for (const id of ids) dirty.get(tx)?.get(ownerKey(owner))?.delete(id);
};

/** A canonical-only row stays absent from queries. Existing query rows must finish
 * their ordinary publication path before committing a changed confirmed state. */
export const finishOrderedRecordWrites = async (tx: OrderedTransaction, owner: StorageOwner) => {
  const pending = [...(dirty.get(tx)?.get(ownerKey(owner)) ?? [])];
  for (let offset = 0; offset < pending.length; offset += 100) {
    const rows = await tx
      .select()
      .from(records)
      .where(and(orderedOwnerWhere(records, owner), inArray(records.record_id, pending.slice(offset, offset + 100))));
    if (rows.some((row) => row.revision !== null))
      throw new Error("Canonical record writes require projection publication");
    for (const row of rows) {
      const canonical = await readCanonicalRecord(tx, owner, row);
      if (!canonical) continue;
      const touched = await tx.execute<{ pending: boolean }>(sql`SELECT EXISTS(SELECT 1 FROM operations
        WHERE owner_id=${row.owner_id} AND envelope IS NOT NULL AND settled_epoch IS NULL
          AND touches @> ARRAY[${row.record_id}]) AS pending`);
      await tx
        .update(records)
        .set({
          ...stableRecordColumns(canonical),
          base: touched.rows[0]!.pending ? confirmedRecordBase(canonical) : null,
        })
        .where(
          and(orderedOwnerWhere(records, owner), sql`${records.record_id}=${row.record_id}`, isNull(records.revision)),
        );
    }
  }
};

/** Capture a confirmed base before replacing any query body with an optimistic overlay. */
export const orderedProjectionFacets = async (tx: OrderedTransaction, owner: StorageOwner, input: OrderedRecord[]) => {
  const facets = new Map<string, ReturnType<typeof stableRecordColumns> & { base: Uint8Array | null }>();
  for (let offset = 0; offset < input.length; offset += 100) {
    const page = input.slice(offset, offset + 100),
      ids = page.map((record) => record.recordId);
    const touched = await tx.execute<{
      record_id: string;
    }>(sql`SELECT DISTINCT unnest(touches) AS record_id FROM operations
      WHERE owner_id=(SELECT id FROM owners WHERE project_id=${owner.workbenchId} AND extension_id=${owner.extensionId})
        AND envelope IS NOT NULL AND settled_epoch IS NULL AND touches && ARRAY[${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )}]::text[]`);
    const pending = new Set(touched.rows.map((row) => row.record_id));
    const rows = pending.size
      ? await tx
          .select()
          .from(records)
          .where(
            and(
              orderedOwnerWhere(records, owner),
              inArray(
                records.record_id,
                ids.filter((id) => pending.has(id)),
              ),
            ),
          )
      : [];
    const before = new Map(rows.map((row) => [row.record_id, row]));
    for (const record of page) {
      const row = before.get(record.recordId);
      facets.set(record.recordId, {
        ...stableRecordColumns(record),
        base: pending.has(record.recordId)
          ? (row?.base ??
            confirmedRecordBase(
              row
                ? await readCanonicalRecord(tx, owner, row)
                : (await readRetainedRecord(tx, owner, record.recordId))?.record,
            ))
          : null,
      });
    }
  }
  return facets;
};
