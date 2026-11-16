import type { StorageOwner } from "pstdio-sync";
import {
  forwardDisplacedSave,
  type OrderedDecision,
  type OrderedOperation,
  type OrderedSkip,
  planCatchUpMoves,
  prepareCatchUpMoves,
} from "pstdio-sync/records";
import type { OrderedJournal } from "./ordered-journal";
import { rememberOrderedTextGeneration } from "./ordered-native-recovery";
import { rebaseOrderedProjection } from "./ordered-rebase";
import { adoptOrderedCheckpoint } from "./ordered-receipts-adoption";
import type { OrderedTransaction } from "./ordered-sql";
import { listProjectedRecords } from "./record-queries";

/** This device's own save that relay order refused or partly skipped, checked for moved items. */
interface DecidedOwnSave {
  operation: OrderedOperation;
  refused: boolean;
  skipped: Set<string>;
}

/**
 * Per stream store. While frames apply, remember this device's own decided saves for that
 * transaction. Afterwards, forward the ones a collection move displaced and move old collection
 * items that are still live although their collection moved. A rolled-back transaction leaves no notes.
 */
export const createDisplacedSaves = (owner: StorageOwner) => {
  const notes = new WeakMap<OrderedTransaction, DecidedOwnSave[]>();
  const settle = async (journal: OrderedJournal, tx: OrderedTransaction, changed: Iterable<string> | undefined) => {
    const decided = notes.get(tx) ?? [];
    notes.delete(tx);
    const canonical = (ids: string[]) => journal.canonical(ids);
    const views = async (ids: string[]) => (await rebaseOrderedProjection(journal, tx, owner, ids)).views;
    const prepared = [];
    for (const save of decided) {
      const next = await forwardDisplacedSave({ ...save, canonical, views });
      if (next) prepared.push(next);
    }
    const list = async (prefix: string) =>
      (await listProjectedRecords(tx, owner, prefix)).map((record) => record.recordId);
    if (changed)
      prepared.push(...(await prepareCatchUpMoves(await planCatchUpMoves({ changed, canonical, list }), views)));
    const queued = new Set<string>();
    for (const next of prepared) {
      await rememberOrderedTextGeneration(tx, owner, next.operation);
      await journal.queue(next.operation, next.identity);
      for (const edit of next.operation.edits) queued.add(edit.recordId);
    }
    return queued;
  };
  return {
    note: async (
      journal: OrderedJournal,
      tx: OrderedTransaction,
      operation: OrderedOperation,
      decision: OrderedDecision,
      skipped: OrderedSkip[],
    ) => {
      const refused = decision.state === "refused";
      if (!(refused || skipped.length) || !(await journal.localOperation(operation.operationId))) return;
      const saves = notes.get(tx) ?? [];
      saves.push({ operation, refused, skipped: new Set(skipped.map((skip) => skip.recordId)) });
      notes.set(tx, saves);
    },
    reauthor: async (journal: OrderedJournal, tx: OrderedTransaction, changed: Set<string>) => {
      for (const id of await settle(journal, tx, [...changed])) changed.add(id);
    },
    adopt: async (input: Parameters<typeof adoptOrderedCheckpoint>[0]) => {
      const merged = await adoptOrderedCheckpoint(input);
      const queued = await settle(input.journal, input.tx, merged.recordIds);
      if (!queued.size) return merged;
      const saved = await rebaseOrderedProjection(input.journal, input.tx, owner, [...queued]);
      // Unknown record IDs already mean every record changed.
      return { ...merged, recordIds: merged.recordIds && [...new Set([...merged.recordIds, ...saved.recordIds])] };
    },
  };
};
