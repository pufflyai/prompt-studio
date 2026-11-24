import type { StorageOwner } from "pstdio-sync";
import { saveLocalFileDocumentStates } from "../../services/extension-storage/document-file-persistence";
import {
  readOrderedMarker,
  readOrderedMarkers,
  saveOrderedMarker,
} from "../../services/extension-storage/ordered-native-metadata";
import { encodeOrderedJson, type OrderedTransaction } from "../../services/extension-storage/ordered-sql";
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
  for (let offset = 0; offset < ids.length; offset += 100)
    for (const [id, value] of await readOrderedMarkers<T>(tx, owner, ids.slice(offset, offset + 100)))
      values.set(id, value.value);
  return values;
};
export const saveConversionValues = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  values: Map<string, unknown>,
) => {
  const entries = [...values];
  for (let offset = 0; offset < entries.length; offset += 100) {
    const states = new Map(entries.slice(offset, offset + 100).map(([id, value]) => [id, encodeOrderedJson(value)]));
    await saveLocalFileDocumentStates(tx, owner, states);
  }
};
