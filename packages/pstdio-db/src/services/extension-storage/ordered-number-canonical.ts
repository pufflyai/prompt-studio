import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedOperation, type OrderedRecord } from "pstdio-sync/records";
import { storage_ordered_resource_numbers as numbers } from "../../db/schemas.pg";
import { jsonBatches } from "./json-batches";
import type { OrderedJournal } from "./ordered-journal";
import { type OrderedNumberIndex, repairOrderedNumbers } from "./ordered-number-repair";
import { numberAliasIntent, numberHistory, orderedNumber, retainNumberHistory } from "./ordered-number-values";
import type { OrderedTransaction } from "./ordered-sql";

const saveNumbers = async (tx: OrderedTransaction, owner: StorageOwner, records: OrderedRecord[]) => {
  for (let offset = 0; offset < records.length; offset += 500) {
    const selected = records.slice(offset, offset + 500);
    await tx.delete(numbers).where(
      and(
        eq(numbers.workbench_id, owner.workbenchId),
        inArray(
          numbers.resource_id,
          selected.map((record) => record.recordId),
        ),
      ),
    );
    const rows = selected.flatMap((record) => {
      const retained = retainNumberHistory(undefined, record);
      const current = orderedNumber(record);
      return Object.entries(numberHistory(retained)).map(([prefix, high_water]) => ({
        workbench_id: owner.workbenchId,
        resource_id: record.recordId,
        prefix,
        high_water,
        extension_id: current?.extensionId ?? "",
        kind: current?.kind ?? "",
        value: current?.prefix === prefix ? current.value : null,
        current: current?.prefix === prefix,
      }));
    });
    for (let start = 0; start < rows.length; start += 500)
      if (rows.length) await tx.insert(numbers).values(rows.slice(start, start + 500));
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
      .select({ value: numbers.high_water })
      .from(numbers)
      .where(and(eq(numbers.workbench_id, owner.workbenchId), eq(numbers.prefix, prefix)))
      .orderBy(desc(numbers.high_water))
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
      const rows = await tx.execute(sql`SELECT i.resource_id FROM storage_ordered_resource_numbers i
        INNER JOIN (SELECT DISTINCT extension_id, kind, prefix, value FROM jsonb_to_recordset(${batch}::jsonb)
          AS k(extension_id text, kind text, prefix text, value bigint)) k USING(extension_id, kind, prefix, value)
        WHERE i.workbench_id = ${owner.workbenchId} AND i.current = true
          AND EXISTS (SELECT 1 FROM storage_ordered_resource_numbers other WHERE other.workbench_id=i.workbench_id
            AND other.current=true AND other.extension_id=i.extension_id AND other.kind=i.kind
            AND other.prefix=i.prefix AND other.value=i.value AND other.resource_id COLLATE "C" < i.resource_id COLLATE "C")`);
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
  await tx.delete(numbers).where(eq(numbers.workbench_id, owner.workbenchId));
  await saveNumbers(tx, owner, records);
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
  await tx.delete(numbers).where(and(eq(numbers.workbench_id, owner.workbenchId), inArray(numbers.resource_id, ids)));
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
      INNER JOIN storage_ordered_resource_numbers c USING(extension_id,kind,prefix,value)
      WHERE c.workbench_id=${owner.workbenchId} AND c.current=true
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(${touched}::jsonb) touched(id) WHERE touched.id=c.resource_id)
      AND EXISTS (SELECT 1 FROM storage_ordered_resource_numbers floor WHERE floor.workbench_id=c.workbench_id
        AND floor.prefix=k.prefix AND floor.high_water>=${Number.MAX_SAFE_INTEGER}) LIMIT 1`);
    if (result.rows.length) return false;
  }
  return true;
};
