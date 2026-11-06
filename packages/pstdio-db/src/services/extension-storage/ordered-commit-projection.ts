import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedOperation, type OrderedRecord, operationDependencies } from "pstdio-sync/records";
import type { NativeProjectedRecord } from "./native-record-projection";
import type { OrderedJournal } from "./ordered-journal";
import { publishOrderedProjection } from "./ordered-projection";
import { rebaseOrderedProjection } from "./ordered-rebase";
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
  records: NativeProjectedRecord[];
}) => {
  const { journal, tx, owner, operation, projected } = input;
  if (
    owner.extensionId === coreOwnerId ||
    operationDependencies(operation).size > 0 ||
    !(await orderedOwnerJoinedCloud(tx, owner, await readOrderedOwner(tx, owner)))
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
