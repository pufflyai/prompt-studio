import { and, eq, inArray } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { documents } from "../../db/schemas/documents";
import { readFileDocumentState, saveFileDocumentState } from "./document-file-persistence";
import { documentFilesFor, withDocumentFileTransaction } from "./document-files";
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
const where = (owner: StorageOwner, id: string) => and(orderedOwnerWhere(documents, owner), eq(documents.key, id));
export const readOrderedMarker = async <T>(tx: Pick<OrderedTransaction, "select">, owner: StorageOwner, id: string) => {
  return withDocumentFileTransaction(tx, async (tx) => {
    const [row] = await tx.select().from(documents).where(where(owner, id));
    return row
      ? {
          value: decodeOrderedJson<T>(await readFileDocumentState(documentFilesFor(tx), owner.workbenchId, row)),
          revision: row.revision,
        }
      : undefined;
  });
};
/** Metadata for one bounded projection batch; standalone text documents stay unopened. */
export const readOrderedMarkers = async <T>(
  tx: Pick<OrderedTransaction, "select">,
  owner: StorageOwner,
  ids: string[],
) => {
  if (ids.length > 100) throw new Error("Read at most 100 native markers per batch");
  if (!ids.length) return new Map<string, { value: T }>();
  return withDocumentFileTransaction(tx, async (tx) => {
    const rows = await tx
      .select()
      .from(documents)
      .where(and(orderedOwnerWhere(documents, owner), inArray(documents.key, ids)));
    return new Map(
      await Promise.all(
        rows.map(
          async (row) =>
            [
              row.key,
              {
                value: decodeOrderedJson<T>(await readFileDocumentState(documentFilesFor(tx), owner.workbenchId, row)),
              },
            ] as const,
        ),
      ),
    );
  });
};
export const saveOrderedMarker = async (tx: OrderedTransaction, owner: StorageOwner, id: string, value: unknown) => {
  await saveFileDocumentState(tx, owner, id, encodeOrderedJson(value));
};
export const roomGeneration = async (tx: Pick<OrderedTransaction, "select">, owner: StorageOwner, roomId: string) =>
  (await readOrderedMarker<{ generation: string }>(tx, owner, orderedRoomMarkerId(roomId)))?.value.generation;
export const removeRoomGeneration = (tx: OrderedTransaction, owner: StorageOwner, roomId: string) =>
  tx.delete(documents).where(where(owner, orderedRoomMarkerId(roomId)));
