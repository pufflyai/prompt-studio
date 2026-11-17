import { and, inArray } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedRecord, projectOrderedOperation } from "pstdio-sync/records";
import { storage_documents as documents } from "../../db/schemas.pg";
import {
  type ConversionCursor,
  readConversionValues,
  saveConversion,
  saveConversionValues,
} from "./ordered-conversion-state";
import type { OrderedJournal } from "./ordered-journal";
import { migrateLegacyNativeFields } from "./ordered-legacy-native";
import { markOrderedNumberProjectionCurrent, publishOrderedNumberIndex } from "./ordered-number-projection";
import { retainNumberHistory } from "./ordered-number-values";
import { publishOrderedProjection, removeOrderedProjection } from "./ordered-projection";
import { encodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

const viewId = (id: string) => JSON.stringify(["ordered-conversion-view", id]);

export const conversionPendingPage = async (journal: OrderedJournal, after?: number) => {
  const selected = [];
  let bytes = 0;
  for (const row of await journal.pending({ after, limit: 32 })) {
    const size = encodeOrderedJson(row.operation).byteLength;
    if (selected.length && bytes + size > 4 * 1024 * 1024) break;
    selected.push(row);
    bytes += size;
  }
  return selected;
};

/** Legacy envelopes are unconditional masked paths. Their final values already passed
 * legacy limits and number repair. Replay queue pages into durable private views rather
 * than expanding transitive group neighbors or rereading a hot record's entire history.
 * Ordinary ordered saves retain the full rebase, group-limit and refusal policy. */
export const projectConversionBatch = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  cursor: ConversionCursor,
) => {
  const page = await conversionPendingPage(journal, cursor.sequence);
  if (!page.length) return saveConversion(tx, owner, { phase: "publish" });
  const ids = [...new Set(page.flatMap(({ operation }) => operation.edits.map((edit) => edit.recordId)))];
  const views = await journal.canonical(ids);
  const staged = await readConversionValues<OrderedRecord>(tx, owner, ids.map(viewId));
  for (const record of staged.values()) views.set(record.recordId, record);
  for (const { operation } of page) {
    if (!operation.operationId.startsWith("legacy-pending:") || operation.edits.some((edit) => edit.condition))
      throw new Error("Only unconditional legacy saves may enter conversion projection");
    for (const record of projectOrderedOperation(views, operation, new Map()))
      views.set(
        record.recordId,
        owner.extensionId === coreOwnerId ? retainNumberHistory(views.get(record.recordId), record) : record,
      );
  }
  await saveConversionValues(
    tx,
    owner,
    new Map([...views.values()].map((record) => [viewId(record.recordId), record])),
  );
  await saveConversion(tx, owner, { phase: "project", sequence: page.at(-1)!.sequence });
};

export const publishConvertedPage = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  ids: string[],
) => {
  const views = await journal.canonical(ids);
  for (const record of (await readConversionValues<OrderedRecord>(tx, owner, ids.map(viewId))).values())
    views.set(record.recordId, record);
  const missing = ids.filter((id) => !views.has(id));
  await removeOrderedProjection(tx, owner, missing);
  const records = [...views.values()];
  await publishOrderedNumberIndex(tx, owner, records, missing);
  await publishOrderedProjection(tx, owner, records);
  await markOrderedNumberProjectionCurrent(tx, owner);
  const native = records.filter((record) => Object.keys(record.texts ?? {}).length).map((record) => record.recordId);
  if (native.length) await migrateLegacyNativeFields(journal, tx, owner, native, views);
  await tx
    .delete(documents)
    .where(and(orderedOwnerWhere(documents, owner), inArray(documents.document_id, ids.map(viewId))));
};
