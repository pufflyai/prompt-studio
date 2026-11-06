import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { storage_documents as documents } from "../../db/schemas.pg";
import { decodeOrderedJson, encodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

export const orderedFieldMarkerId = (key: string) => JSON.stringify(["ordered-native-field", key]);
export const orderedRoomMarkerId = (roomId: string) => JSON.stringify(["ordered-native-room", roomId]);
export interface OrderedFieldMarker {
  recordId: string;
  field: string;
  lifetime: string;
  generation?: string;
  textVersion?: string;
}
const where = (owner: StorageOwner, id: string) =>
  and(orderedOwnerWhere(documents, owner), eq(documents.document_id, id));
export const readOrderedMarker = async <T>(tx: Pick<OrderedTransaction, "select">, owner: StorageOwner, id: string) => {
  const [row] = await tx
    .select({ state: documents.state, revision: documents.revision })
    .from(documents)
    .where(where(owner, id));
  return row ? { value: decodeOrderedJson<T>(row.state), revision: row.revision } : undefined;
};
export const saveOrderedMarker = async (tx: OrderedTransaction, owner: StorageOwner, id: string, value: unknown) => {
  await tx
    .insert(documents)
    .values({
      workbench_id: owner.workbenchId,
      extension_id: owner.extensionId,
      document_id: id,
      state: encodeOrderedJson(value),
    })
    .onConflictDoUpdate({
      target: [documents.workbench_id, documents.extension_id, documents.document_id],
      set: { state: encodeOrderedJson(value), revision: sql`${documents.revision} + 1` },
    });
};
export const roomGeneration = async (tx: Pick<OrderedTransaction, "select">, owner: StorageOwner, roomId: string) =>
  (await readOrderedMarker<{ generation: string }>(tx, owner, orderedRoomMarkerId(roomId)))?.value.generation;
export const removeRoomGeneration = (tx: OrderedTransaction, owner: StorageOwner, roomId: string) =>
  tx.delete(documents).where(where(owner, orderedRoomMarkerId(roomId)));
