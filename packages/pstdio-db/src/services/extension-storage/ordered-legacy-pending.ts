import { and, gt } from "drizzle-orm";
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
import { storage_record_outbox as outbox } from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { normalizeLegacyPendingBaseline, stripLegacyPendingPaths } from "./ordered-legacy-baseline";
import { decodeLegacyPendingFrame, type LegacyRecordPlan, planLegacyPending } from "./ordered-legacy-plan";
import { convertLegacyOrderedRecord } from "./ordered-legacy-record";
import { rememberOrderedTextGeneration } from "./ordered-native-recovery";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { readProjectedRecords } from "./record-queries";

type JsonChange = OrderedOperation["edits"][number]["changes"][number];
interface MigrationState {
  normalized: Set<string>;
  plan: Map<number, Map<string, LegacyRecordPlan>>;
  dirty: Map<string, string[][]>;
}

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
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  row: typeof outbox.$inferSelect,
  state: MigrationState,
) => {
  const frame = decodeLegacyPendingFrame(row.frame);
  const raw = Buffer.from(row.frame).toString("base64");
  const operationId = `legacy-pending:${await fingerprint([owner.workbenchId, owner.extensionId, row.sequence, raw])}`;
  const ids = frame.records.map((record) => record.recordId);
  const targets = await readProjectedRecords(tx, owner, ids);
  const current = new Map(
    await Promise.all(
      targets.map(async (record) => [record.recordId, await convertLegacyOrderedRecord(tx, owner, record)] as const),
    ),
  );
  const plan = state.plan.get(row.sequence);
  if (!plan) throw new Error("A legacy pending frame has no migration proof");
  const edits = [];
  for (const entry of frame.records) {
    const record = current.get(entry.recordId);
    const touched = plan.get(entry.recordId);
    if (!record || !touched) throw new Error("Pending legacy record is missing its conversion proof");
    state.dirty.set(record.recordId, [...(state.dirty.get(record.recordId) ?? []), ...touched.dirty]);
    if (touched.lifecycle && !state.normalized.has(record.recordId)) {
      state.normalized.add(record.recordId);
      await normalizeLegacyPendingBaseline(journal, tx, owner, record, touched.lifecycle);
    }
    const edit = legacyEdit(record, touched);
    if (edit) edits.push(edit);
  }
  if (!edits.length) return [];
  const operation = await prepareOrderedOperation({ operationId, edits }, await journal.canonical(ids));
  await rememberOrderedTextGeneration(tx, owner, operation);
  await journal.queue(operation, await fingerprint(["legacy-frame", raw]));
  return edits.map((edit) => edit.recordId);
};

/** Preserve latest authored pending values, not a speculative reconstruction of garbage-collected old payloads. */
export const migrateLegacyPending = async (journal: OrderedJournal, tx: OrderedTransaction, owner: StorageOwner) => {
  let after = 0;
  const state: MigrationState = { normalized: new Set(), plan: await planLegacyPending(tx, owner), dirty: new Map() };
  const changed = new Set<string>();
  while (true) {
    const rows = await tx
      .select()
      .from(outbox)
      .where(and(orderedOwnerWhere(outbox, owner), gt(outbox.sequence, after)))
      .orderBy(outbox.sequence)
      .limit(32);
    if (!rows.length) {
      await stripLegacyPendingPaths(journal, tx, owner, state.dirty);
      return [...changed];
    }
    for (const row of rows) for (const id of await migrateFrame(journal, tx, owner, row, state)) changed.add(id);
    after = rows.at(-1)!.sequence;
  }
};
