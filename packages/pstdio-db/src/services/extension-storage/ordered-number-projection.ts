import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  coreOwnerId,
  type OrderedOperation,
  type OrderedRecord,
  orderedBody,
  orderedProjection,
  prepareOrderedOperation,
  readOrderedObservation,
} from "pstdio-sync/records";
import { fingerprint, type Json, type StorageRecord } from "pstdio-sync-contracts";
import {
  storage_resource_identities as identities,
  storage_resource_projections as numberProjections,
  storage_record_projections as projections,
} from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import type { OrderedNumberRepair } from "./ordered-number-limits";
import { type OrderedNumberIndex, repairOrderedNumbers } from "./ordered-number-repair";
import {
  numberAlias,
  numberAliasIntent,
  numberHistory,
  orderedNumber,
  renumberOrderedRecord,
  retainNumberHistory,
} from "./ordered-number-values";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { readProjectedRecords } from "./record-queries";
import { indexedNumberCandidate, numberCollisions, projectNumberRecords } from "./resource-number-records";
import type { NumberChange } from "./resource-number-repair";

const projectedViews = async (tx: OrderedTransaction, owner: StorageOwner, ids: string[]) => {
  const records = new Map<string, OrderedRecord>();
  for (const record of await readProjectedRecords(tx, owner, ids)) {
    if (!record.exists) continue;
    const observed = readOrderedObservation(record.revision);
    records.set(record.recordId, {
      recordId: record.recordId,
      deleted: record.deleted,
      lifetime: observed.lifetime!,
      stamps: observed.stamps,
      value: { value: record.value, asset: record.asset, shared: record.shared },
    });
  }
  return records;
};
const absent = (recordId: string): StorageRecord => ({
  recordId,
  exists: false,
  deleted: false,
  value: null,
  asset: null,
  shared: null,
  revision: "",
});
export const publishOrderedNumberIndex = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
  missing: string[] = [],
) => {
  if (owner.extensionId !== coreOwnerId) return;
  const [row] = await tx
    .select({ revision: projections.revision })
    .from(projections)
    .where(orderedOwnerWhere(projections, owner));
  await projectNumberRecords(
    tx,
    owner,
    [...(await Promise.all(records.map(orderedProjection))), ...missing.map(absent)],
    row?.revision ?? 0,
    new Map(
      records.map((record) => [record.recordId, { value: orderedBody(record).value, history: numberHistory(record) }]),
    ),
  );
};

/** Local display repairs never feed canonical claims. Shown numbers become separate durable alias intent. */
export const repairOptimisticNumbers = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  views: Map<string, OrderedRecord>,
  touched: string[],
  validateNumbers: (repairs: OrderedNumberRepair[]) => void,
) => {
  const events: NumberChange[] = [];
  if (owner.extensionId !== coreOwnerId) return { views, events };
  const previous = new Map<string, typeof identities.$inferSelect>();
  const capture = async (ids: string[]) => {
    for (let offset = 0; offset < ids.length; offset += 500) {
      const rows = await tx
        .select()
        .from(identities)
        .where(
          and(
            eq(identities.workbench_id, owner.workbenchId),
            inArray(identities.resource_id, ids.slice(offset, offset + 500)),
          ),
        );
      for (const row of rows) if (!previous.has(row.resource_id)) previous.set(row.resource_id, row);
    }
  };
  await capture(touched);
  await publishOrderedNumberIndex(
    tx,
    owner,
    [],
    touched.filter((id) => !views.has(id)),
  );
  const index: OrderedNumberIndex = {
    validate: async (_records, repairs) => validateNumbers(repairs),
    read: async (ids) => {
      await capture(ids);
      const found = await projectedViews(
        tx,
        owner,
        ids.filter((id) => !views.has(id)),
      );
      for (const id of ids) if (views.has(id)) found.set(id, views.get(id)!);
      return found;
    },
    save: (records) => publishOrderedNumberIndex(tx, owner, records),
    collisions: async (records) =>
      (await numberCollisions(tx, owner, await Promise.all(records.map(orderedProjection)))).map(
        (row) => row.resource_id,
      ),
    next: (prefix) => indexedNumberCandidate(tx, owner.workbenchId, prefix),
    preferred: async (record) => {
      const before = previous.get(record.recordId);
      const number = orderedNumber(record)!;
      if (!before || before.prefix !== number.prefix || before.value === number.value) return;
      const [claimed] = await tx
        .select({ id: identities.resource_id })
        .from(identities)
        .where(
          and(
            eq(identities.workbench_id, owner.workbenchId),
            eq(identities.extension_id, number.extensionId),
            eq(identities.kind, number.kind),
            eq(identities.prefix, number.prefix),
            eq(identities.value, before.value),
          ),
        )
        .limit(1);
      return claimed ? undefined : before.value;
    },
    repairStamp: async (record, value) => {
      const number = orderedNumber(record)!;
      const shorthand = `${number.prefix}-${value}`;
      const operationId = `number-alias:${await fingerprint([record.recordId, record.lifetime, shorthand])}`;
      const operation = await prepareOrderedOperation(
        {
          operationId,
          // Every device derives this same repair; a per-device base would give it different identities.
          edits: [{ recordId: record.recordId, changes: [{ path: ["numberAliases"], set: [shorthand] }], base: null }],
        },
        views,
      );
      if (!(await journal.localOperation(operationId)))
        await journal.queue(operation, await fingerprint(operation as unknown as Json));
      const known = await journal.outcome(operationId);
      return known
        ? JSON.stringify(["canonical", known.epoch, operationId])
        : JSON.stringify(["pending", operationId, operation.fingerprint]);
    },
  };
  for (const record of await repairOrderedNumbers(index, [...views.values()])) views.set(record.recordId, record);
  for (const record of views.values()) {
    const number = orderedNumber(record);
    const before = previous.get(record.recordId)?.shorthand;
    const shorthand = number && `${number.prefix}-${number.value}`;
    if (number && before && before !== shorthand)
      events.push({
        projectId: owner.workbenchId,
        resource: { type: number.kind, id: number.id, extensionId: number.extensionId, projectId: owner.workbenchId },
        previousShorthand: before,
        shorthand: shorthand!,
      });
  }
  return { views, events };
};

export const markOrderedNumberProjectionCurrent = async (tx: OrderedTransaction, owner: StorageOwner) => {
  if (owner.extensionId !== coreOwnerId) return;
  const [row] = await tx
    .select({ revision: projections.revision })
    .from(projections)
    .where(orderedOwnerWhere(projections, owner));
  await tx
    .update(numberProjections)
    .set({ revision: row?.revision ?? 0 })
    .where(eq(numberProjections.workbench_id, owner.workbenchId));
};

/** One committed transaction reports its observable before/after shorthand, never intermediate repairs. */
export const combineNumberEvents = (events: NumberChange[]) => {
  const combined = new Map<string, NumberChange>();
  for (const event of events) {
    const key = JSON.stringify([event.projectId, event.resource.id]);
    const before = combined.get(key)?.previousShorthand ?? event.previousShorthand;
    combined.set(key, { ...event, previousShorthand: before });
  }
  return [...combined.values()].filter((event) => event.shorthand !== event.previousShorthand);
};

/** Recreate the number observed by a conditional child before replaying that child, without changing canonical claims. */
export const projectPendingNumberAlias = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  record: OrderedRecord,
  aliases: Json,
  stamp: string,
) => {
  const number = orderedNumber(record);
  const shown = Array.isArray(aliases) && typeof aliases[0] === "string" ? numberAlias(aliases[0]) : undefined;
  if (!number || !shown || shown.prefix !== number.prefix) return { record, matches: false };
  if (number.value === shown.value) return { record, matches: true };
  const where = and(
    eq(identities.workbench_id, owner.workbenchId),
    eq(identities.extension_id, number.extensionId),
    eq(identities.kind, number.kind),
    eq(identities.prefix, number.prefix),
  );
  const [earlier] = await tx
    .select({ id: identities.resource_id })
    .from(identities)
    .where(
      and(
        where,
        eq(identities.value, number.value),
        sql`${identities.resource_id} COLLATE "C" < ${record.recordId} COLLATE "C"`,
      ),
    )
    .limit(1);
  const [taken] = await tx
    .select({ id: identities.resource_id })
    .from(identities)
    .where(and(where, eq(identities.value, shown.value), ne(identities.resource_id, record.recordId)))
    .limit(1);
  if (!earlier || taken) return { record, matches: false };
  return { record: renumberOrderedRecord(record, shown.value, stamp), matches: true };
};

export const projectPendingNumberRecords = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  before: ReadonlyMap<string, OrderedRecord>,
  records: OrderedRecord[],
  operation: OrderedOperation,
) => {
  if (owner.extensionId !== coreOwnerId) return { records, matches: true };
  const alias = numberAliasIntent(operation);
  const stamp = JSON.stringify(["pending", operation.operationId, operation.fingerprint]);
  let matches = true;
  const projected: OrderedRecord[] = [];
  for (const record of records) {
    let value = retainNumberHistory(before.get(record.recordId), record, alias ? stamp : undefined);
    if (alias) {
      const change = operation.edits.find((edit) => edit.recordId === record.recordId)!.changes[0]!;
      const shown = await projectPendingNumberAlias(tx, owner, value, "set" in change ? change.set : null, stamp);
      value = shown.record;
      matches &&= shown.matches;
    }
    projected.push(value);
  }
  return { records: projected, matches };
};
