import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedRecord } from "pstdio-sync/records";
import { createOrderedJournal, type OrderedJournal } from "./ordered-journal";
import { OrderedNumberLimitError, type OrderedNumberRepair } from "./ordered-number-limits";
import { repairOptimisticNumbers } from "./ordered-number-projection";
import { OrderedNumberRangeError } from "./ordered-number-repair";
import { pendingOrderedOperations } from "./ordered-pending";
import type { OrderedTransaction } from "./ordered-sql";
import type { NumberChange } from "./resource-number-repair";

/** A private repair cannot prevent receiving canonical state. Keep over-limit causative groups queued. */
export const projectWithOrderedNumberPolicy = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  changed: string[],
  project: (
    ids: string[],
    blocked: ReadonlySet<string>,
  ) => Promise<{
    ids: string[];
    views: Map<string, OrderedRecord>;
    suppressed: Set<string>;
    validateNumbers(repairs: OrderedNumberRepair[]): void;
  }>,
) => {
  let affected = changed;
  const blocked = new Set<string>();
  while (true) {
    const projected = await project(affected, blocked);
    if (owner.extensionId !== coreOwnerId) return { ...projected, events: [] as NumberChange[] };
    try {
      const repaired = await tx.transaction((nested) =>
        repairOptimisticNumbers(
          createOrderedJournal(nested, owner),
          nested,
          owner,
          projected.views,
          projected.ids,
          projected.validateNumbers,
        ),
      );
      return { ...repaired, ids: projected.ids, suppressed: projected.suppressed };
    } catch (error) {
      if (!(error instanceof OrderedNumberRangeError || error instanceof OrderedNumberLimitError)) throw error;
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
