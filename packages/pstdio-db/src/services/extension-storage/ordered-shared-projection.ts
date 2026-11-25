import { and, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { type OrderedOperation, type OrderedRecord, orderedBody, orderedProjection } from "pstdio-sync/records";
import { records as current, owners as projections } from "../../db/schemas.pg";
import { jsonBatches } from "./json-batches";
import { orderedCommitVersionColumns } from "./ordered-commit-cache";
import { noteRecordPublication } from "./ordered-record-publication";
import { confirmedRecordBase, orderedRecordMetadata } from "./ordered-record-row";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { encodeProjectionValue } from "./record-projection-codec";
import { storageOwnerKey } from "./storage-owner-key";

/** Shared edits leave an existing plain record's value, lifecycle and native
 * bindings intact. Under the owner lock, update only the changed query columns
 * instead of encoding, reading and sending its potentially large value again. */
export const publishOrderedSharedProjection = async (input: {
  tx: OrderedTransaction;
  owner: StorageOwner;
  operation: OrderedOperation;
  before: ReadonlyMap<string, OrderedRecord>;
  projected: OrderedRecord[];
}) => {
  const { tx, owner, operation, before, projected: visible } = input;
  if (visible.length !== operation.edits.length || !visible.length) return;
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
  // Other saves publish through canonical rebase or the full projection path.
  const records = await Promise.all(visible.map(orderedProjection));
  // Read only the base's presence. An existing pending base stays inside PostgreSQL;
  // only the first optimistic shared edit captures the unchanged confirmed view.
  const baseline = await tx
    .select({ id: current.record_id, pending: sql<boolean>`${current.base} IS NOT NULL` })
    .from(current)
    .where(
      and(
        orderedOwnerWhere(current, owner),
        inArray(
          current.record_id,
          visible.map((record) => record.recordId),
        ),
      ),
    );
  const pending = new Set(baseline.filter((row) => row.pending).map((row) => row.id));
  const metadata = new Map(visible.map((record) => [record.recordId, orderedRecordMetadata(record)]));
  let projected = 0;
  const rows = records.map((record) => ({
    record_id: record.recordId,
    shared: encodeProjectionValue(record.shared),
    revision: record.revision,
    lifetime: record.recordLifetime,
    meta: metadata.get(record.recordId),
    base: pending.has(record.recordId)
      ? null
      : Buffer.from(confirmedRecordBase(before.get(record.recordId))).toString("hex"),
  }));
  for (const batch of jsonBatches(rows)) {
    const changed = await tx.execute(sql`
      UPDATE records current SET shared = input.shared, revision = input.revision,
        meta = input.meta, base = COALESCE(current.base, decode(input.base, 'hex'))
      FROM jsonb_to_recordset(${batch}::jsonb) AS input(record_id text, shared jsonb, revision text, lifetime text, meta jsonb, base text)
      WHERE current.owner_id = ${storageOwnerKey(owner)}
        AND current.record_id = input.record_id AND current.record_lifetime = input.lifetime AND NOT current.deleted AND current.revision IS NOT NULL
      RETURNING current.record_id
    `);
    projected += changed.rows.length;
  }
  if (projected !== records.length) throw new Error("The shared record projection baseline changed");
  const [version] = await tx
    .update(projections)
    .set({ revision: sql`${projections.revision} + 1` })
    .where(orderedOwnerWhere(projections, owner))
    .returning(orderedCommitVersionColumns);
  noteRecordPublication(
    tx,
    owner,
    visible.map((record) => record.recordId),
  );
  return { records, projected, version: version && JSON.stringify(version) };
};
