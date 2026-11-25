import { and, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { operations, owners } from "../../db/schemas.pg";
import { withOrderedOwner } from "./ordered-journal";
import { operationIndexedAt } from "./ordered-receipt-values";
import { orderedOwnerWhere } from "./ordered-sql";
import type { RetainedOperationValue } from "./retained-operations";
import { createRetainedPages } from "./retained-pages";

/** Keep local-only and pending saves until genuine published receipt coverage exists. */
export const pruneSettledOperations = (db: DbClient, owner: StorageOwner, now = new Date()) =>
  withOrderedOwner(db, owner, async (_journal, tx) => {
    const candidates = await tx
      .select({ id: operations.operation_id, bytes: sql<number>`octet_length(row_to_json(operations)::text)` })
      .from(operations)
      .where(
        and(
          orderedOwnerWhere(operations, owner),
          sql`${operations.indexed_at} <= ${new Date(now.getTime() - 7 * 86_400_000).toISOString()}::timestamptz
        AND ${operations.envelope} IS NULL AND ${operations.admission} IS NULL AND ${operations.receipt_indexed}=true
        AND (${operations.request_fingerprint} IS NULL OR ${operations.settled_epoch} IS NOT NULL)`,
        ),
      )
      .orderBy(operations.indexed_at, operations.operation_id)
      .limit(100);
    const ids: string[] = [];
    let bytes = 0;
    for (const row of candidates) {
      if (ids.length && bytes + Number(row.bytes) > 4 * 1024 * 1024) break;
      ids.push(row.id);
      bytes += Number(row.bytes);
    }
    if (!ids.length) return 0;
    const rows = await tx
      .select()
      .from(operations)
      .where(and(orderedOwnerWhere(operations, owner), inArray(operations.operation_id, ids)));
    for (const row of rows)
      if (
        row.envelope !== null ||
        row.admission !== null ||
        !row.indexed_at ||
        operationIndexedAt(row.receipt) !== row.indexed_at ||
        row.touches.length
      )
        throw new Error("Only settled operations with exact published coverage can be retained");
    await createRetainedPages<RetainedOperationValue>(tx, owner, "authorship").set(
      rows.map(({ owner_id: _ownerId, ...row }) => ({
        key: row.operation_id,
        value: { ...row, envelope: null, admission: null },
      })),
    );
    await tx.delete(operations).where(and(orderedOwnerWhere(operations, owner), inArray(operations.operation_id, ids)));
    return rows.length;
  });

/** Runtime work stays bounded and yields to newly arriving requests between owner batches. */
export const pruneStorageOperations = async (db: DbClient, stopped: () => boolean, now = new Date()) => {
  let after = 0;
  while (!stopped()) {
    const [owner] = await db
      .select({ id: owners.id, project_id: owners.project_id, extension_id: owners.extension_id })
      .from(owners)
      .where(sql`${owners.id}>${after} AND EXISTS (
        SELECT 1 FROM operations WHERE owner_id=${owners.id}
          AND indexed_at <= ${new Date(now.getTime() - 7 * 86_400_000).toISOString()}::timestamptz
          AND envelope IS NULL AND admission IS NULL AND receipt_indexed=true
          AND (request_fingerprint IS NULL OR settled_epoch IS NOT NULL)
      )`)
      .orderBy(owners.id)
      .limit(1);
    if (!owner) return;
    after = owner.id;
    const address = { workbenchId: owner.project_id, extensionId: owner.extension_id };
    try {
      while (!stopped()) {
        await Bun.sleep(0);
        if (stopped() || !(await pruneSettledOperations(db, address, now))) break;
      }
    } catch (error) {
      console.warn("Operation retention will retry on the next quiet pass", error);
    }
  }
};
