import { and, inArray } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  applyJsonChanges,
  jsonPointer,
  type OrderedOperation,
  type OrderedRecord,
  parseJsonPointer,
  pathsOverlap,
  prepareOrderedOperation,
  readOrderedPath,
} from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import {
  storage_ordered_records as canonical,
  storage_documents as documents,
  storage_ordered_operations as operations,
  type storage_record_outbox as outbox,
  storage_ordered_touches as touches,
} from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { decodeLegacyPendingFrame, type LegacyRecordPlan } from "./ordered-legacy-plan";
import { convertLegacyOrderedRecords } from "./ordered-legacy-record";
import { rememberOrderedTextGeneration } from "./ordered-native-recovery";
import { indexInitialCanonicalNumbers, removeInitialCanonicalNumbers } from "./ordered-number-canonical";
import { encodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { readProjectedRecords } from "./record-queries";

type JsonChange = OrderedOperation["edits"][number]["changes"][number];

import {
  type ConversionRecord,
  conversionFrameId,
  conversionRecordId,
  readConversionValues,
  saveConversionValues,
} from "./ordered-conversion-state";

const legacyEdit = (record: OrderedRecord, touched: LegacyRecordPlan) => {
  const changes: JsonChange[] = touched.effective.map(({ path, holes }) => {
    const value = readOrderedPath(record.value, path);
    return value === undefined
      ? { path, remove: true }
      : {
          path,
          set: applyJsonChanges(
            value,
            holes.map((path) => ({ path, remove: true })),
          ),
        };
  });
  const texts = Object.entries(record.texts ?? {}).flatMap(([pointer, text]) => {
    const path = parseJsonPointer(pointer);
    const included = touched.effective.some(
      (mask) =>
        (pathsOverlap(mask.path, path) || mask.path[0] === "nativeSources") &&
        !mask.holes.some((hole) => [...mask.path, ...hole].every((key, index) => path[index] === key)),
    );
    return included ? [{ path, update: text.state, seed: text.seed, dependencies: [] }] : [];
  });
  if (!changes.length && !touched.lifecycle) return;
  return {
    recordId: record.recordId,
    changes: changes.filter((change) => !texts.some((text) => jsonPointer(change.path) === jsonPointer(text.path))),
    ...(texts.length ? { texts } : {}),
    ...(touched.lifecycle && touched.lifecycle !== "create" ? { deleted: touched.lifecycle === "delete" } : {}),
  };
};

const migrateFrame = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  row: typeof outbox.$inferSelect,
  plan: Map<string, LegacyRecordPlan>,
  current: Map<string, OrderedRecord>,
  baseline: Map<string, OrderedRecord>,
) => {
  const frame = decodeLegacyPendingFrame(row.frame);
  const raw = Buffer.from(row.frame).toString("base64");
  const operationId = `legacy-pending:${await fingerprint([owner.workbenchId, owner.extensionId, row.sequence, raw])}`;
  const edits = [];
  for (const entry of frame.records) {
    const record = current.get(entry.recordId);
    const touched = plan.get(entry.recordId);
    if (!record || !touched) throw new Error("Pending legacy record is missing its conversion proof");
    const edit = legacyEdit(record, touched);
    if (edit) edits.push(edit);
  }
  if (!edits.length) return;
  const operation = await prepareOrderedOperation({ operationId, edits }, baseline);
  await rememberOrderedTextGeneration(tx, owner, operation);
  return { operation, requestFingerprint: await fingerprint(["legacy-frame", raw]) };
};

const normalizeBatch = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  rows: (typeof outbox.$inferSelect)[],
  plans: Map<string, [string, LegacyRecordPlan][]>,
  current: Map<string, OrderedRecord>,
  state: Map<string, ConversionRecord>,
) => {
  // Normalize each record at its first pending lifecycle, in the same transaction as
  // that page's queue writes. Later frames read the same pre-pending canonical base.
  const removed: string[] = [];
  const normalized: OrderedRecord[] = [];
  for (const row of rows)
    for (const [id, touched] of plans.get(conversionFrameId(row.sequence)) ?? []) {
      const metadata = state.get(conversionRecordId(id));
      if (!metadata) throw new Error("Pending legacy record is missing its path proof");
      if (!touched.lifecycle || metadata.normalized) continue;
      metadata.normalized = true;
      if (touched.lifecycle === "create") removed.push(id);
      else normalized.push({ ...current.get(id)!, deleted: touched.lifecycle === "restore", lifetime: "initial" });
    }
  for (let offset = 0; offset < removed.length; offset += 1000)
    await tx
      .delete(canonical)
      .where(
        and(orderedOwnerWhere(canonical, owner), inArray(canonical.record_id, removed.slice(offset, offset + 1000))),
      );
  await removeInitialCanonicalNumbers(tx, owner, removed);
  await journal.saveCanonical(normalized);
  await indexInitialCanonicalNumbers(tx, owner, normalized);
};

/** A cursor and these new immutable envelopes commit together, so retries never reinsert a batch. */
export const migrateLegacyPendingBatch = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  rows: (typeof outbox.$inferSelect)[],
) => {
  const ids = [
    ...new Set(rows.flatMap((row) => decodeLegacyPendingFrame(row.frame).records.map((record) => record.recordId))),
  ];
  const current = new Map<string, OrderedRecord>();
  for (let offset = 0; offset < ids.length; offset += 100)
    for (const record of await convertLegacyOrderedRecords(
      tx,
      owner,
      await readProjectedRecords(tx, owner, ids.slice(offset, offset + 100)),
    ))
      current.set(record.recordId, record);
  const state = await readConversionValues<ConversionRecord>(tx, owner, ids.map(conversionRecordId));
  const plans = await readConversionValues<[string, LegacyRecordPlan][]>(
    tx,
    owner,
    rows.map((row) => conversionFrameId(row.sequence)),
  );
  await normalizeBatch(journal, tx, owner, rows, plans, current, state);
  const baseline = await journal.canonical(ids);
  const prepared = [];
  for (const row of rows) {
    const plan = plans.get(conversionFrameId(row.sequence));
    if (!plan) throw new Error("A legacy pending frame has no migration proof");
    const value = await migrateFrame(tx, owner, row, new Map(plan), current, baseline);
    if (value) prepared.push(value);
  }
  if (prepared.length) {
    const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId };
    const saved = await tx
      .insert(operations)
      .values(
        prepared.map(({ operation, requestFingerprint }) => ({
          ...address,
          operation_id: operation.operationId,
          fingerprint: operation.fingerprint,
          envelope: encodeOrderedJson(operation),
          request_fingerprint: requestFingerprint,
        })),
      )
      .returning({ id: operations.operation_id, sequence: operations.local_sequence });
    const sequences = new Map(saved.map((row) => [row.id, row.sequence]));
    const memberships = prepared.flatMap(({ operation }) =>
      operation.edits.map((edit) => ({
        ...address,
        operation_id: operation.operationId,
        record_id: edit.recordId,
        local_sequence: sequences.get(operation.operationId)!,
      })),
    );
    for (let offset = 0; offset < memberships.length; offset += 1_000)
      await tx.insert(touches).values(memberships.slice(offset, offset + 1_000));
  }
  await saveConversionValues(tx, owner, state);
  await tx.delete(documents).where(
    and(
      orderedOwnerWhere(documents, owner),
      inArray(
        documents.document_id,
        rows.map((row) => conversionFrameId(row.sequence)),
      ),
    ),
  );
};
