import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedRecord } from "pstdio-sync/records";
import { createOrderedJournal, type OrderedJournal } from "./ordered-journal";
import { repairOptimisticNumbers } from "./ordered-number-projection";
import { OrderedNumberRangeError } from "./ordered-number-repair";
import { pendingOrderedOperations } from "./ordered-pending";
import type { OrderedTransaction } from "./ordered-sql";
import type { NumberChange } from "./resource-number-repair";

/** An exhausted private floor cannot prevent receiving canonical state. Keep causative groups queued. */
export const projectWithOrderedNumberPolicy = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  changed: string[],
  project: (
    ids: string[],
    blocked: ReadonlySet<string>,
  ) => Promise<{ ids: string[]; views: Map<string, OrderedRecord> }>,
) => {
  let affected = changed;
  const blocked = new Set<string>();
  while (true) {
    const projected = await project(affected, blocked);
    if (owner.extensionId !== coreOwnerId) return { ...projected, events: [] as NumberChange[] };
    try {
      const repaired = await tx.transaction((nested) =>
        repairOptimisticNumbers(createOrderedJournal(nested, owner), nested, owner, projected.views, projected.ids),
      );
      return { ...repaired, ids: projected.ids };
    } catch (error) {
      if (!(error instanceof OrderedNumberRangeError)) throw error;
      const ids = new Set([...projected.ids, ...error.resourceIds]);
      const before = blocked.size;
      for await (const { operation } of pendingOrderedOperations(journal, error.resourceIds)) {
        blocked.add(operation.operationId);
        for (const edit of operation.edits) ids.add(edit.recordId);
      }
      // Every retry excludes at least one pending group, never canonical data or an invented decision.
      if (blocked.size === before) throw error;
      affected = [...ids];
    }
  }
};
