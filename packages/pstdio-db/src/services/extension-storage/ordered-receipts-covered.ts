import type { StorageOwner } from "pstdio-sync";
import type { createOrderedReceiptIndex } from "pstdio-sync/records";
import type { OrderedReceipt, RecordStreamCursor } from "pstdio-sync/relay";
import { canonicalJson, type Json } from "pstdio-sync-contracts";
import { dirtyOrderedReceipts } from "./ordered-checkpoint";
import type { OrderedJournal } from "./ordered-journal";
import { receiptRoots, saveReceiptRoots } from "./ordered-receipts-state";
import type { OrderedTransaction } from "./ordered-sql";
import { readOrderedOwner } from "./ordered-stream-state";

/** A future checkpoint's decisions cannot suppress frames this transaction has not applied yet. */
export const coverOrderedReceiptRoot = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  index: ReturnType<typeof createOrderedReceiptIndex>,
  cursor: RecordStreamCursor,
) => {
  const roots = receiptRoots((await readOrderedOwner(tx, owner)).receipt_root);
  if (cursor.receiptRoot === undefined || cursor.receiptStateId === roots.stateId)
    return { ...cursor, receiptRoot: roots.published, receiptStateId: roots.stateId };
  if (cursor.after < cursor.through || cursor.skipped)
    return { ...cursor, receiptRoot: roots.published, receiptStateId: roots.stateId };
  let root = await index.merge(cursor.receiptRoot, roots.root);
  const dirty = await dirtyOrderedReceipts(journal);
  const covered: OrderedReceipt[] = [];
  for (const receipt of dirty) {
    const exact = await index.receipt(cursor.receiptRoot, receipt.decision.epoch, receipt.decision.operationId);
    if (exact && canonicalJson(exact as unknown as Json) === canonicalJson(receipt as unknown as Json))
      covered.push(receipt);
  }
  for (let offset = 0; offset < dirty.length; offset += 100)
    root = await index.append(root, dirty.slice(offset, offset + 100));
  await saveReceiptRoots(tx, owner, { version: 1, root, published: cursor.receiptRoot, stateId: cursor.stateId });
  await journal.markIndexed(covered);
  return { ...cursor, receiptStateId: cursor.stateId };
};
