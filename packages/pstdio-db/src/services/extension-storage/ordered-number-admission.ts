import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedOperation } from "pstdio-sync/records";
import { createOrderedJournal } from "./ordered-journal";
import { repairCanonicalNumbers } from "./ordered-number-canonical";
import { OrderedNumberRangeError } from "./ordered-number-repair";
import type { applyBoundedOrderedOperation } from "./ordered-policy";
import type { OrderedTransaction } from "./ordered-sql";

/** A collision can exhaust the range only after earlier canonical saves. Refuse this group whole. */
export const applyOrderedNumberPolicy = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  operation: OrderedOperation,
  epoch: string,
  result: Awaited<ReturnType<typeof applyBoundedOrderedOperation>>,
  known: boolean,
) => {
  if (owner.extensionId !== coreOwnerId || result.decision.state !== "accepted" || known) return result;
  try {
    const records = await tx.transaction((nested) =>
      repairCanonicalNumbers(
        createOrderedJournal(nested, owner),
        nested,
        owner,
        result.records,
        operation,
        JSON.stringify(["canonical", epoch, operation.operationId]),
      ),
    );
    return { ...result, records };
  } catch (error) {
    if (!(error instanceof OrderedNumberRangeError)) throw error;
    return { decision: { ...result.decision, state: "refused" as const }, records: [] };
  }
};
