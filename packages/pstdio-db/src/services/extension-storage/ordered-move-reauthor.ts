import { and, eq, like } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  forwardDisplacedSave,
  type OrderedDecision,
  type OrderedOperation,
  type OrderedSkip,
  planCatchUpMoves,
  prepareCatchUpMoves,
} from "pstdio-sync/records";
import { storage_current_records as current } from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { rememberOrderedTextGeneration } from "./ordered-native-recovery";
import { rebaseOrderedProjection } from "./ordered-rebase";
import { adoptOrderedCheckpoint } from "./ordered-receipts-adoption";
import type { OrderedTransaction } from "./ordered-sql";
import { orderedOwnerWhere } from "./ordered-sql";
import { listProjectedRecords } from "./record-queries";

/** Every live collection marker; a sync that changed an unknown set of records checks all moved collections. */
const collectionMarkers = async (tx: OrderedTransaction, owner: StorageOwner) =>
  (
    await tx
      .select({ id: current.record_id })
      .from(current)
      .where(
        and(
          orderedOwnerWhere(current, owner),
          eq(current.deleted, false),
          like(current.record_id, '%,"collection-moved",%'),
        ),
      )
  ).map((row) => row.id);

/** This device's saves still waiting for relay order, before a checkpoint settles them. */
const pendingOwnOperations = async (journal: OrderedJournal) => {
  const operations: OrderedOperation[] = [];
  for (let after = 0; ; ) {
    const page = await journal.pending({ after });
    if (!page.length) return operations;
    operations.push(...page.map((local) => local.operation));
    after = page.at(-1)!.sequence;
  }
};

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
    // Unknown changes cover every record, so every moved collection is checked whole.
    const touched = changed ?? (await collectionMarkers(tx, owner));
    prepared.push(...(await prepareCatchUpMoves(await planCatchUpMoves({ changed: touched, canonical, list }), views)));
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
      // A checkpoint settles pending saves without the stream path, so note its refusals here.
      const pending = await pendingOwnOperations(input.journal);
      const merged = await adoptOrderedCheckpoint(input);
      const saves = notes.get(input.tx) ?? [];
      // Saves admitted in the checkpoint's tail were already noted on the stream path.
      const noted = new Set(saves.map((save) => save.operation.operationId));
      for (const operation of pending)
        if (
          !noted.has(operation.operationId) &&
          (await input.journal.outcome(operation.operationId))?.state === "refused"
        )
          saves.push({ operation, refused: true, skipped: new Set() });
      notes.set(input.tx, saves);
      const queued = await settle(input.journal, input.tx, merged.recordIds);
      if (!queued.size) return merged;
      const saved = await rebaseOrderedProjection(input.journal, input.tx, owner, [...queued]);
      // Unknown record IDs already mean every record changed.
      return { ...merged, recordIds: merged.recordIds && [...new Set([...merged.recordIds, ...saved.recordIds])] };
    },
  };
};
