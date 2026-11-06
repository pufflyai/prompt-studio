import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { type OrderedOperation, type OrderedRecord, orderedBody } from "pstdio-sync/records";
import { storage_record_projections as projections } from "../../db/schemas.pg";
import { jsonBatches } from "./json-batches";
import type { NativeProjectedRecord } from "./native-record-projection";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { encodeProjectionValue } from "./record-projection-codec";

/** Shared edits leave an existing plain record's value, lifecycle and native
 * bindings intact. Under the owner lock, update only the changed query columns
 * instead of encoding, reading and sending its potentially large value again. */
export const publishOrderedSharedProjection = async (input: {
  tx: OrderedTransaction;
  owner: StorageOwner;
  operation: OrderedOperation;
  before: ReadonlyMap<string, OrderedRecord>;
  records: NativeProjectedRecord[];
}) => {
  const { tx, owner, operation, before, records } = input;
  if (records.length !== operation.edits.length || !records.length) return;
  for (const edit of operation.edits) {
    const previous = before.get(edit.recordId);
    if (
      edit.deleted !== undefined ||
      edit.texts?.length ||
      !edit.changes.length ||
      edit.changes.some((change) => change.path[0] !== "shared") ||
      !previous ||
      previous.deleted ||
      Object.keys(previous.texts ?? {}).length ||
      Object.keys(orderedBody(previous).nativeSources).length
    )
      return;
  }
  let projected = 0;
  const rows = records.map((record) => ({
    record_id: record.recordId,
    shared: encodeProjectionValue(record.shared),
    revision: record.revision,
    lifetime: record.recordLifetime,
  }));
  for (const batch of jsonBatches(rows)) {
    const changed = await tx.execute(sql`
      UPDATE storage_current_records current SET shared = input.shared, revision = input.revision
      FROM jsonb_to_recordset(${batch}::jsonb) AS input(record_id text, shared jsonb, revision text, lifetime text)
      WHERE current.workbench_id = ${owner.workbenchId} AND current.extension_id = ${owner.extensionId}
        AND current.record_id = input.record_id AND current.record_lifetime = input.lifetime AND NOT current.deleted
      RETURNING current.record_id
    `);
    projected += changed.rows.length;
  }
  if (projected !== records.length) throw new Error("The shared record projection baseline changed");
  await tx
    .update(projections)
    .set({ revision: sql`${projections.revision} + 1` })
    .where(orderedOwnerWhere(projections, owner));
  return { records, projected };
};
