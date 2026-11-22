import type { OperationReceipts } from "../../db/schemas/storage-ordered-records";

export const operationReceipt = (receipts: OperationReceipts, epoch: string) =>
  Object.getOwnPropertyDescriptor(receipts, epoch)?.value as OperationReceipts[string] | undefined;
export const operationReceiptsIndexed = (receipts: OperationReceipts) =>
  Object.values(receipts).every((receipt) => receipt.indexed);
