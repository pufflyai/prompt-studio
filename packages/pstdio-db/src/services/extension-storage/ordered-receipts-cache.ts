import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedReceipt } from "pstdio-sync/relay";
import type { OperationReceipt } from "../../db/schemas/storage-ordered-records";
import { storage_ordered_operations as operations } from "../../db/schemas.pg";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { storageOwnerKey } from "./storage-owner-key";

export const createOrderedReceiptCache = (tx: OrderedTransaction, owner: StorageOwner) => ({
  async cachedReceipt(operationId: string, epoch: string): Promise<OrderedReceipt | undefined> {
    const [row] = await tx
      .select({
        receipt: sql<OperationReceipt | null>`${operations.receipt}->${epoch}::text`,
        fingerprint: operations.fingerprint,
      })
      .from(operations)
      .where(and(orderedOwnerWhere(operations, owner), eq(operations.operation_id, operationId)));
    if (!row?.receipt) return;
    const receipt = row.receipt;
    return {
      decision: { epoch, operationId, fingerprint: row!.fingerprint, state: receipt.state },
      admissionFingerprint: receipt.admissionFingerprint,
    };
  },
  async unindexed(
    options: { after?: { epoch: string; operationId: string }; limit?: number } = {},
  ): Promise<OrderedReceipt[]> {
    const after = options.after;
    const limit = options.limit ?? 100;
    // Internal cursors seek operation first, then epoch. Limit identities before
    // expanding their maps so each page never sorts the owner's entire dirty history.
    const result = await tx.execute<{
      epoch: string;
      operation_id: string;
      fingerprint: string;
      receipt: OperationReceipt;
    }>(sql`WITH candidates AS MATERIALIZED (
      SELECT operation_id,fingerprint,receipt FROM operations
      WHERE owner_id=${storageOwnerKey(owner)} AND receipt_indexed=false
        ${
          after
            ? sql`AND operation_id>=${after.operationId}
          AND (operation_id>${after.operationId} OR EXISTS (
            SELECT 1 FROM jsonb_each(receipt) r(key,value)
            WHERE r.key>${after.epoch} AND r.value->>'indexed'='false'))`
            : sql``
        }
      ORDER BY operation_id LIMIT ${limit}
    ) SELECT fact.key AS epoch,o.operation_id,o.fingerprint,fact.value AS receipt
      FROM candidates o CROSS JOIN LATERAL (
        SELECT key,value FROM jsonb_each(o.receipt) r(key,value)
        WHERE r.value->>'indexed'='false'
          ${after ? sql`AND (o.operation_id>${after.operationId} OR r.key>${after.epoch})` : sql``}
        ORDER BY key LIMIT ${limit}
      ) fact
      ORDER BY o.operation_id,fact.key LIMIT ${limit}`);
    return result.rows.map((row) => ({
      decision: {
        epoch: row.epoch,
        operationId: row.operation_id,
        fingerprint: row.fingerprint,
        state: row.receipt.state,
      },
      admissionFingerprint: row.receipt.admissionFingerprint,
    }));
  },
  async markIndexed(covered: OrderedReceipt[]) {
    for (let offset = 0; offset < covered.length; offset += 100) {
      const page = covered.slice(offset, offset + 100);
      await tx.execute(sql`WITH covered AS (
        SELECT o.owner_id,o.operation_id,jsonb_object_agg(f.epoch,
          (o.receipt->f.epoch) || '{"indexed":true}'::jsonb) AS receipt
        FROM operations o JOIN jsonb_to_recordset(${JSON.stringify(
          page.map((entry) => ({
            operation_id: entry.decision.operationId,
            epoch: entry.decision.epoch,
            admission_fingerprint: entry.admissionFingerprint,
          })),
        )}::jsonb) AS f(operation_id text,epoch text,admission_fingerprint text)
          ON o.operation_id=f.operation_id
        WHERE o.owner_id=${storageOwnerKey(owner)}
          AND o.receipt->f.epoch->>'indexed'='false'
          AND o.receipt->f.epoch->>'admissionFingerprint'=f.admission_fingerprint
        GROUP BY o.owner_id,o.operation_id
      ) UPDATE operations o SET receipt=o.receipt || c.receipt,
        receipt_indexed=NOT EXISTS (SELECT 1 FROM jsonb_each(o.receipt || c.receipt) fact(key,value)
          WHERE fact.value->>'indexed'='false')
        FROM covered c WHERE o.owner_id=c.owner_id AND o.operation_id=c.operation_id`);
    }
  },
});
