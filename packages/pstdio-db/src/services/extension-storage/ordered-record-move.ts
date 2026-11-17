import type { StorageObserver, StorageOwner } from "pstdio-sync";
import { type OrderedMoveInput, prepareOrderedMove } from "pstdio-sync/records";
import type { DbClient } from "../../db/connection.pglite";
import { type OrderedJournal, withOrderedOwner } from "./ordered-journal";
import { rememberOrderedTextGeneration } from "./ordered-native-recovery";
import { combineNumberEvents } from "./ordered-number-projection";
import { rebaseOrderedProjection } from "./ordered-rebase";
import type { OrderedTransaction } from "./ordered-sql";

/** Queue a prepared move under the owner lock and publish the moved records. */
export const moveOrderedRecords = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  input: OrderedMoveInput,
) => {
  const ids = [
    ...input.moves.flatMap(({ from, to }) => [from, to]),
    ...(input.extra ?? []).map((edit) => edit.recordId),
    ...(input.guard ? [input.guard.recordId] : []),
  ];
  const { views } = await rebaseOrderedProjection(journal, tx, owner, ids);
  const { moved, remaining, operation, identity } = await prepareOrderedMove(views, input);
  if (!operation) return { moved, remaining, saved: undefined };
  await rememberOrderedTextGeneration(tx, owner, operation);
  await journal.queue(operation, identity);
  const saved = await rebaseOrderedProjection(journal, tx, owner, ids);
  // The rebase can republish other pending records; observers advance only for records this move wrote.
  const authored = new Set(operation.edits.map((edit) => edit.recordId));
  const records = saved.suppressed.has(operation.operationId)
    ? []
    : saved.records.filter((record) => authored.has(record.recordId));
  return { moved, remaining, saved: { ...saved, records } };
};

/** Run a move under the owner lock and notify like a local commit. */
export const moveOrderedRecordsIn = async (
  db: DbClient,
  owner: StorageOwner,
  deps: {
    statistics: { record(count: number): void };
    numbersChanged?: (events: ReturnType<typeof combineNumberEvents>) => void;
    changed: (recordIds?: readonly string[]) => void;
    observer?: StorageObserver;
  },
  input: OrderedMoveInput,
  committed: () => void,
) => {
  const result = await withOrderedOwner(db, owner, (journal, tx) => moveOrderedRecords(journal, tx, owner, input));
  const saved = result.saved;
  if (saved) {
    if (saved.projected) deps.statistics.record(saved.projected);
    deps.numbersChanged?.(combineNumberEvents(saved.events));
    if (saved.recordIds.length) deps.changed(saved.recordIds);
    if (saved.records.length) deps.observer?.committed(owner, saved.records, { status: "saved-locally" });
  }
  committed();
  return { moved: result.moved, remaining: result.remaining };
};
