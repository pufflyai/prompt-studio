import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedOperation, type OrderedRecord } from "pstdio-sync/records";
import { resource_numbers as numbers } from "../../db/schemas.pg";
import { jsonBatches } from "./json-batches";
import type { OrderedJournal } from "./ordered-journal";
import { type OrderedNumberIndex, repairOrderedNumbers } from "./ordered-number-repair";
import {
  numberAlias,
  numberAliasIntent,
  numberHistory,
  orderedNumber,
  retainNumberHistory,
  shownNumberAliases,
} from "./ordered-number-values";
import type { OrderedTransaction } from "./ordered-sql";

const pruneUnusedNumbers = (tx: OrderedTransaction, owner: StorageOwner, ids?: string[]) =>
  tx
    .delete(numbers)
    .where(
      and(
        eq(numbers.project_id, owner.workbenchId),
        eq(numbers.current, false),
        eq(numbers.alias, false),
        eq(numbers.canonical, false),
        ids ? inArray(numbers.resource_id, ids) : undefined,
      ),
    );

const saveNumbers = async (tx: OrderedTransaction, owner: StorageOwner, records: OrderedRecord[]) => {
  for (let offset = 0; offset < records.length; offset += 500) {
    const selected = records.slice(offset, offset + 500);
    await tx
      .update(numbers)
      .set({ canonical: false, canonical_current: false })
      .where(
        and(
          eq(numbers.project_id, owner.workbenchId),
          inArray(
            numbers.resource_id,
            selected.map((record) => record.recordId),
          ),
        ),
      );
    const rows = selected.flatMap((record) => {
      const retained = retainNumberHistory(undefined, record),
        current = orderedNumber(record),
        previous = orderedNumber(record, true);
      const namespace = current ?? previous;
      const values = new Map<string, { prefix: string; value: number }>();
      for (const [prefix, value] of Object.entries(numberHistory(retained)))
        values.set(`${prefix}-${value}`, { prefix, value });
      for (const alias of [...shownNumberAliases(retained), ...(previous?.aliases ?? [])]) {
        const value = numberAlias(alias);
        if (value) values.set(alias, value);
      }
      if (current) values.set(`${current.prefix}-${current.value}`, { prefix: current.prefix, value: current.value });
      return [...values].map(([shorthand, value]) => ({
        project_id: owner.workbenchId,
        resource_id: record.recordId,
        shorthand,
        ...value,
        extension_id: namespace?.extensionId ?? "",
        kind: namespace?.kind ?? "",
        canonical: true,
        canonical_current: current?.prefix === value.prefix && current.value === value.value,
      }));
    });
    for (const batch of jsonBatches(rows))
      await tx.execute(sql`INSERT INTO resource_numbers
      (project_id,resource_id,shorthand,prefix,value,extension_id,kind,canonical,canonical_current)
      SELECT project_id,resource_id,shorthand,prefix,value,extension_id,kind,true,canonical_current
      FROM jsonb_to_recordset(${batch}::jsonb) AS r(project_id text,resource_id text,shorthand text,prefix text,
        value bigint,extension_id text,kind text,canonical boolean,canonical_current boolean)
      ON CONFLICT(project_id,shorthand,resource_id) DO UPDATE SET canonical=true,canonical_current=excluded.canonical_current,
        extension_id=CASE WHEN resource_numbers.current THEN resource_numbers.extension_id ELSE excluded.extension_id END,
        kind=CASE WHEN resource_numbers.current THEN resource_numbers.kind ELSE excluded.kind END`);
    await pruneUnusedNumbers(
      tx,
      owner,
      selected.map((record) => record.recordId),
    );
  }
};

const canonicalNumberIndex = (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
): OrderedNumberIndex => ({
  read: (ids) => journal.canonical(ids),
  save: (records) => saveNumbers(tx, owner, records),
  async next(prefix) {
    const [row] = await tx
      .select({ value: numbers.value })
      .from(numbers)
      .where(and(eq(numbers.project_id, owner.workbenchId), eq(numbers.prefix, prefix), eq(numbers.canonical, true)))
      .orderBy(desc(numbers.value))
      .limit(1);
    return (row?.value ?? 0) + 1;
  },
  async collisions(records) {
    const keys = [
      ...new Map(
        records.flatMap((record) => {
          const number = orderedNumber(record);
          return number
            ? [[JSON.stringify([number.extensionId, number.kind, number.prefix, number.value]), number] as const]
            : [];
        }),
      ).values(),
    ];
    const losers = new Set<string>();
    for (const batch of jsonBatches(
      keys.map((number) => ({
        extension_id: number.extensionId,
        kind: number.kind,
        prefix: number.prefix,
        value: number.value,
      })),
    )) {
      // Every other current holder of a requested number is itself a claimant, so the losers are the
      // claimants after the first one per number, found in one pass instead of one prefix scan per number.
      const rows = await tx.execute(sql`SELECT resource_id FROM (
          SELECT i.resource_id, min(i.resource_id COLLATE "C")
            OVER (PARTITION BY i.extension_id, i.kind, i.prefix, i.value) AS first
          FROM resource_numbers i
          INNER JOIN (SELECT DISTINCT extension_id, kind, prefix, value FROM jsonb_to_recordset(${batch}::jsonb)
            AS k(extension_id text, kind text, prefix text, value bigint)) k USING(extension_id, kind, prefix, value)
          WHERE i.project_id = ${owner.workbenchId} AND i.canonical_current = true
        ) claims WHERE resource_id COLLATE "C" > first`);
      for (const row of rows.rows as { resource_id: string }[]) losers.add(row.resource_id);
    }
    return [...losers].sort();
  },
});

/** Fresh accepted groups repair only canonical claims; replica-local pending floors are irrelevant. */
export const repairCanonicalNumbers = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
  operation: OrderedOperation,
  stamp: string,
) => {
  if (owner.extensionId !== coreOwnerId || (!records.length && !numberAliasIntent(operation))) return records;
  return repairOrderedNumbers(canonicalNumberIndex(journal, tx, owner), records, operation, stamp);
};

/** Called only for snapshot adoption or initial conversion, never for ordinary record saves. */
export const resetCanonicalNumberIndex = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
) => {
  if (owner.extensionId !== coreOwnerId) return;
  await tx
    .update(numbers)
    .set({ canonical: false, canonical_current: false })
    .where(eq(numbers.project_id, owner.workbenchId));
  await saveNumbers(tx, owner, records);
  await pruneUnusedNumbers(tx, owner);
};

/** Initial conversion is paged; each batch imports only its genuine retained values. */
export const indexInitialCanonicalNumbers = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
) => {
  if (owner.extensionId === coreOwnerId) await saveNumbers(tx, owner, records);
};

/** Legacy pending creations belong to the queue, not the imported canonical claim set. */
export const removeInitialCanonicalNumbers = async (tx: OrderedTransaction, owner: StorageOwner, ids: string[]) => {
  if (owner.extensionId !== coreOwnerId || !ids.length) return;
  await tx
    .update(numbers)
    .set({ canonical: false, canonical_current: false })
    .where(and(eq(numbers.project_id, owner.workbenchId), inArray(numbers.resource_id, ids)));
  await pruneUnusedNumbers(tx, owner, ids);
};

/** An impossible pending repair cannot block receiving its earlier canonical competitor. */
export const canProjectOrderedNumbers = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
) => {
  if (owner.extensionId !== coreOwnerId) return true;
  const keys = records.flatMap((record) => {
    const number = orderedNumber(record);
    return number
      ? [{ extension_id: number.extensionId, kind: number.kind, prefix: number.prefix, value: number.value }]
      : [];
  });
  const touched = JSON.stringify(records.map((record) => record.recordId));
  for (const batch of jsonBatches(keys)) {
    const result =
      await tx.execute(sql`SELECT 1 FROM jsonb_to_recordset(${batch}::jsonb) AS k(extension_id text, kind text, prefix text, value bigint)
      INNER JOIN resource_numbers c USING(extension_id,kind,prefix,value)
      WHERE c.project_id=${owner.workbenchId} AND c.canonical_current=true
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(${touched}::jsonb) touched(id) WHERE touched.id=c.resource_id)
      AND EXISTS (SELECT 1 FROM resource_numbers floor WHERE floor.project_id=c.project_id
        AND floor.prefix=k.prefix AND floor.canonical=true AND floor.value>=${Number.MAX_SAFE_INTEGER}) LIMIT 1`);
    if (result.rows.length) return false;
  }
  return true;
};
