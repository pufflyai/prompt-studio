import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { owners } from "../../db/schemas.pg";
import { assertStorageOwnerAdmitted } from "../../db/storage-admission";
import { canonicalRecordPredicate } from "./ordered-record-row";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { retainedPageKey } from "./retained-page-format";
import { storageOwnerKey } from "./storage-owner-key";

/** Progress polls must not contend with synchronization for the project write lock. */
export const readOrderedPending = async (db: Pick<OrderedTransaction, "select">, owner: StorageOwner) => {
  assertStorageOwnerAdmitted(db, owner);
  const [row] = await db
    .select({
      pending: sql<boolean>`
    EXISTS (SELECT 1 FROM operations p
      WHERE p.owner_id = ${storageOwnerKey(owner)}
      AND p.envelope IS NOT NULL AND p.settled_epoch IS NULL)
    OR (
      NOT (${owners.joined} OR (${owners.epoch} IS NOT NULL AND ${owners.epoch} <> '' AND ${owners.epoch} NOT LIKE 'local:%'))
      AND (EXISTS (SELECT 1 FROM records c
        WHERE c.owner_id = ${storageOwnerKey(owner)} AND ${canonicalRecordPredicate({ meta: sql`c.meta`, base: sql`c.base` })})
        OR EXISTS (SELECT 1 FROM documents d WHERE d.owner_id=${storageOwnerKey(owner)}
          AND d.key=${retainedPageKey("tombstones", "")}))
    )
  `,
    })
    .from(owners)
    .where(orderedOwnerWhere(owners, owner));
  return row?.pending;
};
