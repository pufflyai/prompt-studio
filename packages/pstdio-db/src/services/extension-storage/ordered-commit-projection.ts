import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedOperation, type OrderedRecord, operationDependencies } from "pstdio-sync/records";
import type { OrderedJournal } from "./ordered-journal";
import { publishOrderedProjection } from "./ordered-projection";
import { rebaseOrderedProjection } from "./ordered-rebase";
import { orderedSavesFold } from "./ordered-return";
import { publishOrderedSharedProjection } from "./ordered-shared-projection";
import type { OrderedTransaction } from "./ordered-sql";
import { orderedOwnerJoinedCloud, readOrderedOwner } from "./ordered-stream-state";
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
}) => {
  const { journal, tx, owner, operation, projected } = input;
  const row = await readOrderedOwner(tx, owner);
  // A base over this device's own pending saves projects optimistically like an independent save.
  if (
    owner.extensionId === coreOwnerId ||
    operationDependencies(operation, { base: false }).size > 0 ||
    !(await orderedOwnerJoinedCloud(tx, owner, row)) ||
    (await orderedSavesFold(tx, owner, row))
  )
    return rebaseOrderedProjection(
      journal,
      tx,
      owner,
      operation.edits.map((edit) => edit.recordId),
    );
  return {
    ...((await publishOrderedSharedProjection(input)) ?? (await publishOrderedProjection(tx, owner, projected))),
    events: [] as NumberChange[],
    suppressed: new Set(projected.length ? [] : [operation.operationId]),
  };
};
