import { and, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { storage_documents as documents } from "../../db/schemas.pg";
import { readOrderedMarker, saveOrderedMarker } from "./ordered-native-metadata";
import { decodeOrderedJson, encodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

export const conversionId = '["ordered-conversion"]';
export const conversionFrameId = (sequence: number) => JSON.stringify(["ordered-conversion-frame", sequence]);
export const conversionRecordId = (id: string) => JSON.stringify(["ordered-conversion-record", id]);
export interface ConversionCursor {
  phase: "records" | "plan" | "pending" | "strip" | "settle" | "project" | "publish" | "cleanup";
  after?: string;
  sequence?: number;
}
export interface ConversionRecord {
  paths: string[][];
  normalized?: boolean;
}
export const readConversion = async (tx: Pick<OrderedTransaction, "select">, owner: StorageOwner) =>
  (await readOrderedMarker<ConversionCursor>(tx, owner, conversionId))?.value;
export const saveConversion = (tx: OrderedTransaction, owner: StorageOwner, cursor: ConversionCursor) =>
  saveOrderedMarker(tx, owner, conversionId, cursor);

export const readConversionValues = async <T>(
  tx: Pick<OrderedTransaction, "select">,
  owner: StorageOwner,
  ids: string[],
) => {
  const values = new Map<string, T>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const rows = await tx
      .select({ id: documents.document_id, state: documents.state })
      .from(documents)
      .where(and(orderedOwnerWhere(documents, owner), inArray(documents.document_id, ids.slice(offset, offset + 100))));
    for (const row of rows) values.set(row.id, decodeOrderedJson<T>(row.state));
  }
  return values;
};
export const saveConversionValues = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  values: Map<string, unknown>,
) => {
  const rows = [...values].map(([id, value]) => ({
    workbench_id: owner.workbenchId,
    extension_id: owner.extensionId,
    document_id: id,
    state: encodeOrderedJson(value),
  }));
  for (let offset = 0; offset < rows.length; offset += 100)
    await tx
      .insert(documents)
      .values(rows.slice(offset, offset + 100))
      .onConflictDoUpdate({
        target: [documents.workbench_id, documents.extension_id, documents.document_id],
        set: { state: sql`excluded.state`, revision: sql`${documents.revision} + 1` },
      });
};
