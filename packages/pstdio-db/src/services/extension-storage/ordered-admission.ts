import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { type OrderedAdmission, verifyOrderedAdmission } from "pstdio-sync/records";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import { operations } from "../../db/schemas.pg";
import { encodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

/** Validate and publish under the owner lock without reading the immutable payload back. */
export const admitOrderedOperation = async (tx: OrderedTransaction, owner: StorageOwner, input: OrderedAdmission) => {
  const admission = await verifyOrderedAdmission(input);
  const identity = await fingerprint(admission as unknown as Json);
  const where = and(orderedOwnerWhere(operations, owner), eq(operations.operation_id, admission.operation.operationId));
  const sameEpoch = sql`${operations.admission_epoch} = ${admission.epoch}`;
  const [saved] = await tx
    .update(operations)
    .set({
      admission_epoch: admission.epoch,
      admission: sql`CASE WHEN ${sameEpoch} THEN ${operations.admission} ELSE ${encodeOrderedJson(admission)} END`,
      admission_fingerprint: identity,
      delivered: sql`CASE WHEN ${sameEpoch} THEN ${operations.delivered} ELSE false END`,
    })
    .where(
      and(
        where,
        eq(operations.fingerprint, admission.operation.fingerprint),
        isNotNull(operations.envelope),
        isNull(operations.settled_epoch),
        sql`(${operations.admission_epoch} IS DISTINCT FROM ${admission.epoch} OR ${operations.admission_fingerprint} = ${identity})`,
      ),
    )
    .returning({ id: operations.operation_id });
  if (saved) return;
  const [row] = await tx
    .select({
      fingerprint: operations.fingerprint,
      pending: sql<boolean>`${operations.envelope} IS NOT NULL`,
      settled: operations.settled_epoch,
      epoch: operations.admission_epoch,
      identity: operations.admission_fingerprint,
    })
    .from(operations)
    .where(where);
  if (!row?.pending || row.fingerprint !== admission.operation.fingerprint)
    throw new Error("Operation identity reused with changed payload");
  if (row.settled) throw new Error("A settled save cannot enter another order");
  if (row.epoch === admission.epoch && row.identity !== identity)
    throw new Error("An admission is immutable within its order epoch");
  throw new Error("The ordered admission was not saved");
};
