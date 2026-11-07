import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { jsonPointer, type OrderedOperation, type OrderedSkip } from "pstdio-sync/records";
import { storage_current_records as current } from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { saveOrderedMarker } from "./ordered-native-metadata";
import { pendingOrderedOperations } from "./ordered-pending";
import {
  dropPending,
  editRecords,
  orderedReturnLimits,
  readOrderedReturnState,
  setOrderedReturnState,
} from "./ordered-return";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

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

/** Live records as this device shows them; tombstones do not dilute the share of deletions. */
const liveCount = async (tx: OrderedTransaction, owner: StorageOwner) => {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(current)
    .where(and(orderedOwnerWhere(current, owner), eq(current.deleted, false)));
  return row?.count ?? 0;
};

/**
 * On reconnecting after time signed out, a large return waits for review; anything smaller uploads
 * under the base rule. A signed-in device that only passed the unsent-save limit never left, so it
 * uploads under the base rule without a hold.
 */
export const evaluateOrderedReturn = async (journal: OrderedJournal, tx: OrderedTransaction, owner: StorageOwner) => {
  const state = await readOrderedReturnState(tx, owner);
  if (state === "folded") {
    await setOrderedReturnState(tx, owner, null);
    return null;
  }
  // `signed-out` here means the connection started before the refresh marked the owner returning.
  if (state !== "signed-out" && state !== "returning") return state;
  const summary = await orderedReturnSummary(journal);
  const limits = orderedReturnLimits;
  const held =
    summary.deletions > limits.deletions ||
    summary.records.length > limits.records ||
    (summary.deletions >= limits.minimumDeletions &&
      summary.deletions * 2 >= (await liveCount(tx, owner)) + summary.deletions);
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

/** One notice per record, private to this device like other ordered markers. */
export const orderedReplacedPrefix = '["ordered-replaced",';
export interface OrderedReplacedNotice {
  paths: string[];
  whole: boolean;
  deleted: boolean;
  replacedAt: number;
}

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
  const replacedAt = Date.now();
  for (const skip of skipped) {
    const edit = operation.edits.find((candidate) => candidate.recordId === skip.recordId);
    await saveOrderedMarker(tx, owner, JSON.stringify(["ordered-replaced", skip.recordId]), {
      paths: skip.paths,
      whole: skip.whole,
      deleted: edit?.deleted === true,
      replacedAt,
    } satisfies OrderedReplacedNotice);
  }
};
