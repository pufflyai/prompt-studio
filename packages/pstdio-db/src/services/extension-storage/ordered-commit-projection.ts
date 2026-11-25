import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedOperation, type OrderedRecord, operationDependencies } from "pstdio-sync/records";
import type { OrderedJournal } from "./ordered-journal";
import type { OrderedLocalSettlement } from "./ordered-local-settlement";
import { publishOrderedProjection } from "./ordered-projection";
import { rebaseOrderedProjection } from "./ordered-rebase";
import { canAppendOrderedProjection } from "./ordered-return";
import { publishOrderedSharedProjection } from "./ordered-shared-projection";
import type { OrderedTransaction } from "./ordered-sql";
import type { NumberChange } from "./resource-number-repair";

/** The owner transaction already validated the whole pending prefix before compilation.
 * Its new independent save can extend that prefix without replaying it a second time. */
export const publishCommittedOrderedGroup = async (input: {
  journal: OrderedJournal;
  tx: OrderedTransaction;
  owner: StorageOwner;
  operation: OrderedOperation;
  projected: OrderedRecord[];
  before: ReadonlyMap<string, OrderedRecord>;
  localOwner?: OrderedLocalSettlement["ownerState"];
  queued: Awaited<ReturnType<OrderedJournal["queueWithStatus"]>>;
}) => {
  const { journal, tx, owner, operation, projected, localOwner, queued } = input;
  const local = localOwner && queued.enqueued ? { ownerState: localOwner, queued: queued.save } : undefined;
  // A base over this device's own pending saves projects optimistically like an independent save.
  if (
    local ||
    owner.extensionId === coreOwnerId ||
    operationDependencies(operation, { base: false }).size > 0 ||
    !(await canAppendOrderedProjection(tx, owner))
  )
    return rebaseOrderedProjection(
      journal,
      tx,
      owner,
      operation.edits.map((edit) => edit.recordId),
      local,
    );
  const shared = await publishOrderedSharedProjection(input);
  return {
    ...(shared ?? (await publishOrderedProjection(tx, owner, projected))),
    events: [] as NumberChange[],
    suppressed: new Set(projected.length ? [] : [operation.operationId]),
    recordIds: projected.map((record) => record.recordId),
  };
};
