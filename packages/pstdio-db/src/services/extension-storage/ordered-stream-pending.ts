import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { storage_ordered_owners as owners } from "../../db/schemas.pg";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

/** Progress polls must not contend with synchronization for the project write lock. */
export const readOrderedPending = async (db: Pick<OrderedTransaction, "select">, owner: StorageOwner) => {
  const [row] = await db
    .select({
      pending: sql<boolean>`
    EXISTS (SELECT 1 FROM storage_ordered_operations p
      WHERE p.workbench_id = ${owners.workbench_id} AND p.extension_id = ${owners.extension_id}
      AND p.envelope IS NOT NULL AND p.settled_epoch IS NULL)
    OR (
      NOT (${owners.joined} OR (${owners.epoch} IS NOT NULL AND ${owners.epoch} <> '' AND ${owners.epoch} NOT LIKE 'local:%'))
      AND NOT EXISTS (SELECT 1 FROM storage_record_sync l
        WHERE l.workbench_id = ${owners.workbench_id} AND l.extension_id = ${owners.extension_id} AND l.joined)
      AND EXISTS (SELECT 1 FROM storage_ordered_records c
        WHERE c.workbench_id = ${owners.workbench_id} AND c.extension_id = ${owners.extension_id})
    )
  `,
    })
    .from(owners)
    .where(orderedOwnerWhere(owners, owner));
  return row?.pending;
};
