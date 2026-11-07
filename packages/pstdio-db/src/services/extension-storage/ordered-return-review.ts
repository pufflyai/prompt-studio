import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { jsonPointer, type OrderedOperation, type OrderedSkip } from "pstdio-sync/records";
import { storage_ordered_records as records, storage_ordered_replaced as replaced } from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { pendingOrderedOperations } from "./ordered-pending";
import { dropPending, editRecords, orderedReturnLimits, setOrderedReturnState } from "./ordered-return";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { readOrderedOwner } from "./ordered-stream-state";

export interface OrderedReturnSummary {
  records: { recordId: string; paths: string[]; deleted: boolean; created: boolean }[];
  deletions: number;
}

/** What this device would send on return, read from its pending saves. */
export const orderedReturnSummary = async (journal: OrderedJournal) => {
  const changed = new Map<string, { paths: Set<string>; deleted: boolean; created: boolean }>();
  for await (const local of pendingOrderedOperations(journal)) {
    for (const edit of local.operation.edits) {
      const entry = changed.get(edit.recordId) ?? { paths: new Set<string>(), deleted: false, created: false };
      for (const change of edit.changes) entry.paths.add(jsonPointer(change.path));
      for (const text of edit.texts ?? []) entry.paths.add(jsonPointer(text.path));
      if (edit.deleted !== undefined) entry.deleted = edit.deleted;
      if (edit.base && !edit.base.exists) entry.created = true;
      changed.set(edit.recordId, entry);
    }
  }
  const list = [...changed].map(([recordId, entry]) => ({
    recordId,
    paths: [...entry.paths].sort(),
    deleted: entry.deleted,
    created: entry.created,
  }));
  return { records: list, deletions: list.filter((entry) => entry.deleted).length } satisfies OrderedReturnSummary;
};

const canonicalCount = async (tx: OrderedTransaction, owner: StorageOwner) => {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(records)
    .where(orderedOwnerWhere(records, owner));
  return row?.count ?? 0;
};

/** On reconnecting, a large return waits for review; anything smaller uploads under the base rule. */
export const evaluateOrderedReturn = async (journal: OrderedJournal, tx: OrderedTransaction, owner: StorageOwner) => {
  const row = await readOrderedOwner(tx, owner);
  if (row.return_state !== "signed-out" && row.return_state !== "folded") return row.return_state;
  const summary = await orderedReturnSummary(journal);
  const limits = orderedReturnLimits;
  const held =
    summary.deletions > limits.deletions ||
    summary.records.length > limits.records ||
    (summary.deletions >= limits.minimumDeletions && summary.deletions * 2 >= (await canonicalCount(tx, owner)));
  const next = held ? "held" : null;
  await setOrderedReturnState(tx, owner, next);
  return next;
};

/** Drop every unsent save so this owner shows Cloud's copy, then sync again. */
export const discardOrderedReturn = async (journal: OrderedJournal, tx: OrderedTransaction, owner: StorageOwner) => {
  const ids = new Set<string>();
  const dropped: string[] = [];
  for await (const local of pendingOrderedOperations(journal)) {
    if (local.delivered) continue;
    dropped.push(local.operation.operationId);
    for (const id of editRecords(local)) ids.add(id);
  }
  await dropPending(tx, owner, dropped);
  await setOrderedReturnState(tx, owner, null);
  return [...ids];
};

/** Remember which of this device's changes Cloud did not apply, so the person can see them. */
export const recordOrderedReplaced = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  operation: OrderedOperation,
  skipped: OrderedSkip[],
) => {
  // Only this device's own saves become notices; other devices' skipped writes are not news here.
  if (!skipped.length || !(await journal.localOperation(operation.operationId))) return;
  const now = Date.now();
  for (const skip of skipped) {
    const edit = operation.edits.find((candidate) => candidate.recordId === skip.recordId);
    const row = {
      workbench_id: owner.workbenchId,
      extension_id: owner.extensionId,
      record_id: skip.recordId,
      paths: skip.paths,
      whole: skip.whole,
      deleted: edit?.deleted === true,
      replaced_at: now,
    };
    await tx
      .insert(replaced)
      .values(row)
      .onConflictDoUpdate({
        target: [replaced.workbench_id, replaced.extension_id, replaced.record_id],
        set: { paths: row.paths, whole: row.whole, deleted: row.deleted, replaced_at: row.replaced_at },
      });
  }
};
