import type { StorageOwner } from "pstdio-sync";
import type { OrderedAdmission } from "pstdio-sync/records";
import type { createOrderedReceiptIndex, OrderedIndexReference } from "pstdio-sync/relay";
import { decodeOrderedEntry, type OrderedStreamEntry, type RecordStreamCursor } from "pstdio-sync/relay";
import {
  storage_ordered_records as canonical,
  storage_current_records as current,
  storage_record_projections as projections,
} from "../../db/schemas.pg";
import { dirtyOrderedReceipts } from "./ordered-checkpoint";
import { queueOrderedCheckpointRepairs } from "./ordered-checkpoint-repair";
import type { OrderedJournal } from "./ordered-journal";
import { resetCanonicalNumberIndex } from "./ordered-number-canonical";
import { rebaseOrderedProjection } from "./ordered-rebase";
import { createOrderedReceiptResolver } from "./ordered-receipts-resolver";
import { receiptRoots, sameReceiptRoot, saveReceiptRoots } from "./ordered-receipts-state";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { readOrderedOwner, saveOrderedCursor } from "./ordered-stream-state";

const checkpointEntries = async (remote: Map<string, Uint8Array[]>) => {
  const entries = [];
  for (const states of remote.values()) for (const state of states) entries.push(await decodeOrderedEntry(state));
  return entries;
};
const applyCheckpointTail = async (
  entries: OrderedStreamEntry[],
  apply: (entry: Extract<OrderedStreamEntry, { type: "admission" | "text" }>) => Promise<string[]>,
) => {
  const changed = new Set<string>();
  for (const entry of entries) {
    if (entry.type !== "admission" && entry.type !== "text") continue;
    for (const id of await apply(entry)) changed.add(id);
  }
  return changed;
};

export const adoptOrderedCheckpoint = async (input: {
  journal: OrderedJournal;
  tx: OrderedTransaction;
  owner: StorageOwner;
  index: ReturnType<typeof createOrderedReceiptIndex>;
  remote: Map<string, Uint8Array[]>;
  cursor: RecordStreamCursor;
  applyAdmission: (
    journal: OrderedJournal,
    tx: OrderedTransaction,
    admission: OrderedAdmission,
    epoch: string,
    root: OrderedIndexReference | null,
  ) => Promise<string[]>;
  applyNative: (
    journal: OrderedJournal,
    tx: OrderedTransaction,
    admission: OrderedAdmission,
    epoch: string,
    root: OrderedIndexReference | null,
  ) => Promise<string[]>;
}) => {
  const { journal, tx, owner, index, cursor } = input;
  const entries = await checkpointEntries(input.remote);
  const metadata = entries.filter((entry) => entry.type === "meta");
  if (metadata.length !== 1) throw new Error("A checkpoint requires exactly one order identity");
  const meta = metadata[0]!;
  if (cursor.receiptRoot !== undefined && !sameReceiptRoot(cursor.receiptRoot, meta.receiptRoot))
    throw new Error("Checkpoint summary and payload disagree about its receipt root");
  const owned = await readOrderedOwner(tx, owner);
  const previous = receiptRoots(owned.receipt_root);
  const records = entries.flatMap((entry) => (entry.type === "record" ? [entry.record] : []));
  if (owned.epoch === meta.epoch)
    await queueOrderedCheckpointRepairs({
      journal,
      tx,
      owner,
      index,
      checkpointRoot: meta.receiptRoot,
      localRoot: previous.root,
      records,
    });
  let root = await index.merge(meta.receiptRoot, previous.root);
  const dirty = await dirtyOrderedReceipts(journal);
  for (let offset = 0; offset < dirty.length; offset += 100)
    root = await index.append(root, dirty.slice(offset, offset + 100));
  const resolver = createOrderedReceiptResolver(journal, root, index);
  let after = 0;
  const pendingIds = new Set<string>();
  while (true) {
    const page = await journal.pending({ after });
    if (!page.length) break;
    for (const local of page) {
      await resolver.reconcile(local, meta.epoch);
      for (const edit of local.operation.edits) pendingIds.add(edit.recordId);
    }
    after = page.at(-1)!.sequence;
  }
  if (new Set(records.map((record) => record.recordId)).size !== records.length)
    throw new Error("A checkpoint repeats a record");
  await tx.delete(canonical).where(orderedOwnerWhere(canonical, owner));
  await tx.delete(current).where(orderedOwnerWhere(current, owner));
  await tx.update(projections).set({ live_count: 0 }).where(orderedOwnerWhere(projections, owner));
  await journal.saveCanonical(records);
  await resetCanonicalNumberIndex(tx, owner, records);
  const tail = await applyCheckpointTail(entries, (entry) =>
    entry.type === "text"
      ? input.applyNative(journal, tx, entry.admission, meta.epoch, root)
      : input.applyAdmission(journal, tx, entry.admission, meta.epoch, root),
  );
  const changed = new Set([...pendingIds, ...records.map((record) => record.recordId), ...tail]);
  const saved = await rebaseOrderedProjection(journal, tx, owner, [...changed]);
  await saveReceiptRoots(tx, owner, { version: 1, root, published: meta.receiptRoot, stateId: cursor.stateId });
  await saveOrderedCursor(tx, owner, cursor, meta.epoch);
  return {
    events: saved.events,
    rejected: [] as string[],
    cursor: { ...cursor, receiptRoot: meta.receiptRoot, receiptStateId: cursor.stateId },
  };
};
