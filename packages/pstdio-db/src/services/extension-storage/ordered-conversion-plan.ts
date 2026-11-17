import type { StorageOwner } from "pstdio-sync";
import * as Y from "yjs";
import type { storage_record_outbox as outbox } from "../../db/schemas.pg";
import {
  type ConversionRecord,
  conversionFrameId,
  conversionRecordId,
  readConversionValues,
  saveConversionValues,
} from "./ordered-conversion-state";
import { decodeLegacyPendingFrame, LegacyPendingMask, planLegacyFrame } from "./ordered-legacy-plan";
import type { OrderedTransaction } from "./ordered-sql";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";

/** Reverse planning retains only this page and the touched records' path masks in memory. */
export const planLegacyBatch = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  rows: (typeof outbox.$inferSelect)[],
) => {
  const ids = [
    ...new Set(rows.flatMap((row) => decodeLegacyPendingFrame(row.frame).records.map((record) => record.recordId))),
  ];
  const previous = await readConversionValues<ConversionRecord>(tx, owner, ids.map(conversionRecordId));
  const covered = new LegacyPendingMask(
    new Map(ids.map((id) => [id, previous.get(conversionRecordId(id))?.paths ?? []])),
  );
  const sources: Awaited<ReturnType<typeof loadResourceDocuments>>["sources"] = new Map();
  for (let offset = 0; offset < ids.length; offset += 100)
    for (const [id, source] of (
      await loadResourceDocuments(tx, owner, ids.slice(offset, offset + 100).map(resourceDocumentId))
    ).sources)
      sources.set(id, source);
  const documents = new Map<string, Y.Doc>();
  try {
    for (const id of ids) {
      const source = sources.get(resourceDocumentId(id));
      if (!source) throw new Error("Pending legacy record is missing its conversion source");
      const document = new Y.Doc();
      documents.set(id, document);
      for (const state of source.states) Y.applyUpdate(document, state);
    }
    const saved = new Map<string, unknown>();
    for (const row of rows)
      saved.set(conversionFrameId(row.sequence), [...planLegacyFrame(row.frame, covered, documents)]);
    for (const id of ids) saved.set(conversionRecordId(id), { paths: covered.paths(id) } satisfies ConversionRecord);
    await saveConversionValues(tx, owner, saved);
  } finally {
    for (const document of documents.values()) document.destroy();
  }
};
