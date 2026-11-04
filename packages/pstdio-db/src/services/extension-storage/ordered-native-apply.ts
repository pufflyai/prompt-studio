import type { StorageOwner } from "pstdio-sync";
import {
  applyOrderedNativeOperation,
  type createOrderedReceiptIndex,
  type OrderedAdmission,
  type OrderedIndexReference,
} from "pstdio-sync/records";
import type { OrderedJournal } from "./ordered-journal";
import { admissionDecisions } from "./ordered-rebase";
import { createOrderedReceiptResolver } from "./ordered-receipts-resolver";
import { receiptRoots } from "./ordered-receipts-state";
import type { OrderedTransaction } from "./ordered-sql";
import { readOrderedOwner } from "./ordered-stream-state";

export const applyOrderedNativeAdmission = async (input: {
  journal: OrderedJournal;
  tx: OrderedTransaction;
  owner: StorageOwner;
  index: ReturnType<typeof createOrderedReceiptIndex>;
  admission: OrderedAdmission;
  epoch: string;
  root?: OrderedIndexReference | null;
}) => {
  const { journal, tx, owner, admission, epoch, index } = input;
  if (admission.epoch !== epoch) throw new Error("A text frame belongs to another order epoch");
  const root =
    input.root === undefined ? receiptRoots((await readOrderedOwner(tx, owner)).receipt_root).root : input.root;
  await createOrderedReceiptResolver(journal, root, index).hydrateDependencies(admission);
  const ids = admission.operation.edits.map((edit) => edit.recordId);
  const result = await applyOrderedNativeOperation(
    await journal.canonical(ids),
    admission.operation,
    epoch,
    await admissionDecisions(journal, admission),
  );
  await journal.saveCanonical(result.records);
  await journal.completeNative(admission.operation, result.state);
  return ids;
};
