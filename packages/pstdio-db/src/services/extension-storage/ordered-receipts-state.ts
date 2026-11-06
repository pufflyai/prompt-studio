import type { StorageOwner } from "pstdio-sync";
import { type OrderedIndexReference, readOrderedIndexReference } from "pstdio-sync/relay";
import { storage_ordered_owners as owners } from "../../db/schemas.pg";
import { decodeOrderedJson, encodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

export interface OrderedReceiptRoots {
  version: 1;
  root: OrderedIndexReference | null;
  published: OrderedIndexReference | null;
  stateId: string | null;
}
export const receiptRoots = (bytes: Uint8Array | null) => {
  if (!bytes) return { version: 1 as const, root: null, published: null, stateId: null };
  const value = decodeOrderedJson<OrderedReceiptRoots>(bytes);
  if (
    !value ||
    value.version !== 1 ||
    Object.keys(value).length !== 4 ||
    (value.stateId !== null && typeof value.stateId !== "string")
  )
    throw new Error("Invalid saved receipt roots");
  return {
    version: 1 as const,
    root: value.root === null ? null : readOrderedIndexReference(value.root),
    published: value.published === null ? null : readOrderedIndexReference(value.published),
    stateId: value.stateId,
  };
};
export const saveReceiptRoots = (tx: OrderedTransaction, owner: StorageOwner, roots: OrderedReceiptRoots) =>
  tx
    .update(owners)
    .set({ receipt_root: encodeOrderedJson(roots) })
    .where(orderedOwnerWhere(owners, owner));
export const sameReceiptRoot = (first: OrderedIndexReference | null, second: OrderedIndexReference | null) =>
  first?.blobId === second?.blobId && first?.byteLength === second?.byteLength;
