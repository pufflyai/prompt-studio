import type { OrderedDecision } from "pstdio-sync/records";
import type { OperationReceipts } from "../../db/schemas/storage-ordered-records";

export const operationReceipt = (receipts: OperationReceipts, epoch: string) =>
  Object.getOwnPropertyDescriptor(receipts, epoch)?.value as OperationReceipts[string] | undefined;
export const operationReceiptsIndexed = (receipts: OperationReceipts) =>
  Object.values(receipts).every((receipt) => receipt.indexed);

/** Old indexed flags remain visible to the API but cannot start a pruning clock without proof. */
export const operationIndexedAt = (receipts: OperationReceipts) => {
  const values = Object.values(receipts);
  if (!values.length || values.some((receipt) => !receipt.indexed || !receipt.indexedAt)) return null;
  const times = values.map((receipt) => Date.parse(receipt.indexedAt!));
  if (times.some((time) => !Number.isFinite(time))) throw new Error("Invalid receipt coverage time");
  return new Date(Math.max(...times)).toISOString();
};

export const recordOperationReceipt = (
  previous: OperationReceipts,
  { epoch, state }: OrderedDecision,
  admissionFingerprint: string,
  indexed = false,
) => {
  const retained = operationReceipt(previous, epoch);
  if (retained && (retained.state !== state || retained.admissionFingerprint !== admissionFingerprint))
    throw new Error("An ordered decision is immutable");
  const indexedAt = retained?.indexedAt || indexed ? (retained?.indexedAt ?? new Date().toISOString()) : undefined;
  const receipt = {
    ...previous,
    [epoch]: {
      state,
      admissionFingerprint,
      indexed: !!retained?.indexed || !!indexed,
      ...(indexedAt === undefined ? {} : { indexedAt }),
    },
  };
  return {
    receipt,
    receipt_epoch: epoch,
    receipt_indexed: operationReceiptsIndexed(receipt),
    indexed_at: operationIndexedAt(receipt),
  };
};
