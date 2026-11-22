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
