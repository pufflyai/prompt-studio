import { and, eq, gt, or, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedReceipt } from "pstdio-sync/relay";
import { storage_ordered_operations as operations, storage_ordered_receipts as receipts } from "../../db/schemas.pg";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

export const createOrderedReceiptCache = (tx: OrderedTransaction, owner: StorageOwner) => {
  const rows = () =>
    tx
      .select({
        epoch: receipts.epoch,
        operationId: receipts.operation_id,
        fingerprint: operations.fingerprint,
        state: receipts.state,
        admissionFingerprint: receipts.admission_fingerprint,
      })
      .from(receipts)
      .innerJoin(
        operations,
        and(
          eq(operations.workbench_id, receipts.workbench_id),
          eq(operations.extension_id, receipts.extension_id),
          eq(operations.operation_id, receipts.operation_id),
        ),
      );
  const asReceipt = ({
    admissionFingerprint,
    ...decision
  }: Awaited<ReturnType<ReturnType<typeof rows>["where"]>>[number]) => ({ decision, admissionFingerprint });
  return {
    async cachedReceipt(operationId: string, epoch: string) {
      const [row] = await rows().where(
        and(orderedOwnerWhere(receipts, owner), eq(receipts.operation_id, operationId), eq(receipts.epoch, epoch)),
      );
      return row ? asReceipt(row) : undefined;
    },
    async unindexed(options: { after?: { epoch: string; operationId: string }; limit?: number } = {}) {
      const after = options.after;
      const page = await rows()
        .where(
          and(
            orderedOwnerWhere(receipts, owner),
            eq(receipts.indexed, false),
            after &&
              or(
                gt(receipts.epoch, after.epoch),
                and(eq(receipts.epoch, after.epoch), gt(receipts.operation_id, after.operationId)),
              ),
          ),
        )
        .orderBy(receipts.epoch, receipts.operation_id)
        .limit(options.limit ?? 100);
      return page.map(asReceipt);
    },
    async markIndexed(covered: OrderedReceipt[]) {
      for (let offset = 0; offset < covered.length; offset += 100) {
        const page = covered.slice(offset, offset + 100).map((receipt) => ({
          epoch: receipt.decision.epoch,
          operation_id: receipt.decision.operationId,
          admission_fingerprint: receipt.admissionFingerprint,
        }));
        await tx.execute(sql`UPDATE storage_ordered_receipts receipt SET indexed = true FROM jsonb_to_recordset(${JSON.stringify(page)}::jsonb) included(epoch text, operation_id text, admission_fingerprint text)
          WHERE receipt.workbench_id = ${owner.workbenchId} AND receipt.extension_id = ${owner.extensionId} AND receipt.epoch = included.epoch AND receipt.operation_id = included.operation_id AND receipt.admission_fingerprint = included.admission_fingerprint`);
      }
    },
  };
};
