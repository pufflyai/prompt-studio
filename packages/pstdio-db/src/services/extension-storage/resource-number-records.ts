import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type NumberedResource, retainedResourceValue } from "pstdio-sync/records";
import type { StorageRecord } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  resource_numbers as identities,
  owners as projections,
  resource_prefixes as sequences,
} from "../../db/schemas.pg";
import { jsonBatches } from "./json-batches";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";
import { writeResourceQueryValues } from "./resource-query-values";
import { storageOwnerKey } from "./storage-owner-key";

export type NumberRecord = NumberedResource & { aliases: string[] };
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const aliasNumber = (shorthand: string) => {
  const separator = shorthand.lastIndexOf("-");
  const suffix = shorthand.slice(separator + 1);
  const value = Number(suffix);
  if (separator < 1 || !/^[1-9]\d*$/.test(suffix) || !Number.isSafeInteger(value)) return;
  return { shorthand, prefix: shorthand.slice(0, separator), value };
};

export const numberIndexString = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code === 0 || (code >= 0xd800 && code <= 0xdfff)) return false;
  }
  return true;
};

const hasNumberValue = (record: StorageRecord) => {
  if (!record.exists) return false;
  const value = record.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    value.id === record.recordId &&
    numberIndexString(value.extensionId) &&
    numberIndexString(value.kind) &&
    numberIndexString(value.prefix) &&
    typeof value.value === "number" &&
    Number.isSafeInteger(value.value) &&
    value.value > 0 &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => numberIndexString(alias) && aliasNumber(alias) !== undefined)
  );
};

export const isNumberRecord = (record: StorageRecord) => !record.deleted && hasNumberValue(record);

export const numberValue = (record: StorageRecord) => {
  const value = record.value as unknown as NumberRecord;
  return { ...value, extensionId: canonicalExtensionId(value.extensionId) };
};

/** Both indexes include numeric values: a large former alias must never be allocated again. */
export const indexedNumberCandidate = async (tx: Transaction, projectId: string, prefix: string) => {
  const where = and(eq(sequences.project_id, projectId), eq(sequences.prefix, prefix));
  const [sequence] = await tx.select({ next: sequences.next_value }).from(sequences).where(where);
  const [highest] = await tx
    .select({ value: identities.value })
    .from(identities)
    .where(and(eq(identities.project_id, projectId), eq(identities.prefix, prefix)))
    .orderBy(desc(identities.value))
    .limit(1);
  return Math.max((sequence?.next ?? 1) - 1, highest?.value ?? 0) + 1;
};
export const nextIndexedNumber = async (tx: Transaction, projectId: string, prefix: string) => {
  const value = await indexedNumberCandidate(tx, projectId, prefix);
  if (!Number.isSafeInteger(value)) throw new Error(`Resource number range exhausted for prefix ${prefix}`);
  return value;
};

type RetainedNumberValues = ReadonlyMap<string, { value: StorageRecord["value"]; history: Record<string, number> }>;
const retainedNumberValues = async (
  tx: Transaction,
  owner: StorageOwner,
  deleted: StorageRecord[],
  retained?: RetainedNumberValues,
) => {
  const retainedNumbers: NumberRecord[] = [];
  for (let offset = 0; offset < deleted.length; offset += 1_000) {
    const batch = deleted.slice(offset, offset + 1_000);
    if (retained) {
      for (const record of batch) {
        const value = retained.get(record.recordId)?.value;
        const candidate = { ...record, value: value ?? null };
        if (hasNumberValue(candidate)) retainedNumbers.push(numberValue(candidate));
      }
      continue;
    }
    const { sources } = await loadResourceDocuments(
      tx,
      owner,
      batch.map((record) => resourceDocumentId(record.recordId)),
    );
    for (const record of batch) {
      const source = sources.get(resourceDocumentId(record.recordId))!;
      const value = retainedResourceValue(record.recordId, source.states);
      const retained = { ...record, value };
      if (hasNumberValue(retained)) retainedNumbers.push(numberValue(retained));
    }
  }
  return retainedNumbers;
};

/** Maintained in the same transaction as the canonical core records, for local and remote writes. */
export const projectNumberRecords = async (
  tx: Transaction,
  owner: StorageOwner,
  records: StorageRecord[],
  revision: number,
  retained?: RetainedNumberValues,
) => {
  if (owner.extensionId !== coreOwnerId || !records.length) return;
  await tx
    .update(projections)
    .set({ numbers_revision: revision })
    .where(eq(projections.id, storageOwnerKey(owner)));
  const ids = records.map((record) => record.recordId);
  for (let offset = 0; offset < ids.length; offset += 1_000) {
    const selected = ids.slice(offset, offset + 1_000);
    const scope = and(eq(identities.project_id, owner.workbenchId), inArray(identities.resource_id, selected));
    await tx.update(identities).set({ current: false, alias: false }).where(scope);
    await tx.delete(identities).where(and(scope, eq(identities.canonical, false)));
  }
  const live = records.filter(isNumberRecord).map(numberValue);
  for (const batch of jsonBatches(
    live.map((r) => ({
      resource_id: r.id,
      extension_id: r.extensionId,
      kind: r.kind,
      prefix: r.prefix,
      value: r.value,
      shorthand: `${r.prefix}-${r.value}`,
    })),
  )) {
    await tx.execute(sql`INSERT INTO resource_numbers
      (project_id, resource_id, extension_id, kind, prefix, value, shorthand,current)
      SELECT ${owner.workbenchId}, i.resource_id, i.extension_id, i.kind, i.prefix, i.value, i.shorthand,true
      FROM jsonb_to_recordset(${batch}::jsonb) AS i(resource_id text, extension_id text, kind text, prefix text, value bigint, shorthand text)
      ON CONFLICT(project_id,shorthand,resource_id) DO UPDATE SET current=true,
        extension_id=excluded.extension_id,kind=excluded.kind,prefix=excluded.prefix,value=excluded.value`);
  }
  // Retained tombstones also carry history to a fresh device before its first allocation.
  const retainedNumbers = await retainedNumberValues(
    tx,
    owner,
    records.filter((record) => record.exists && record.deleted),
    retained,
  );
  const history = [
    ...live.map((r) => ({ id: r.id, aliases: r.aliases })),
    ...retainedNumbers.map((r) => ({ id: r.id, aliases: [...r.aliases, `${r.prefix}-${r.value}`] })),
  ].flatMap((r) => [...new Set(r.aliases)].map((shorthand) => ({ resource_id: r.id, ...aliasNumber(shorthand)! })));
  for (const [resource_id, metadata] of retained ?? [])
    for (const [prefix, value] of Object.entries(metadata.history))
      history.push({ resource_id, shorthand: `${prefix}-${value}`, prefix, value });
  const uniqueHistory = [
    ...new Map(history.map((entry) => [JSON.stringify([entry.resource_id, entry.shorthand]), entry])).values(),
  ];

  const namespaces = new Map([...live, ...retainedNumbers].map((row) => [row.id, row]));
  for (const batch of jsonBatches(
    uniqueHistory.map((row) => ({
      ...row,
      extension_id: namespaces.get(row.resource_id)?.extensionId ?? "",
      kind: namespaces.get(row.resource_id)?.kind ?? "",
    })),
  )) {
    await tx.execute(sql`INSERT INTO resource_numbers (project_id, resource_id, shorthand, prefix, value,extension_id,kind,alias)
      SELECT ${owner.workbenchId}, i.resource_id, i.shorthand, i.prefix, i.value,i.extension_id,i.kind,true
      FROM jsonb_to_recordset(${batch}::jsonb) AS i(resource_id text, shorthand text, prefix text, value bigint,extension_id text,kind text)
      ON CONFLICT(project_id,shorthand,resource_id) DO UPDATE SET alias=true`);
  }
  const aliasesById = new Map<string, string[]>();
  for (const entry of uniqueHistory) {
    const values = aliasesById.get(entry.resource_id) ?? [];
    values.push(entry.shorthand);
    aliasesById.set(entry.resource_id, values);
  }
  await writeResourceQueryValues(
    tx,
    owner.workbenchId,
    live.map((record) => ({
      id: record.id,
      shorthand: `${record.prefix}-${record.value}`,
      aliases: aliasesById.get(record.id) ?? [],
    })),
  );
  for (const batch of jsonBatches(
    [...live, ...retainedNumbers].map((r) => ({
      extension_id: r.extensionId,
      kind: r.kind,
      prefix: r.prefix,
      value: r.aliases.reduce((highest, shorthand) => {
        const alias = aliasNumber(shorthand)!;
        return alias.prefix === r.prefix ? Math.max(highest, alias.value) : highest;
      }, r.value),
    })),
  )) {
    await tx.execute(sql`INSERT INTO resource_prefixes
      (project_id, extension_id, kind, prefix, next_value)
      SELECT ${owner.workbenchId}, i.extension_id, i.kind, i.prefix, max(i.value) + 1
      FROM jsonb_to_recordset(${batch}::jsonb) AS i(extension_id text, kind text, prefix text, value bigint)
      GROUP BY i.extension_id, i.kind, i.prefix
      ON CONFLICT (project_id, extension_id, kind) DO UPDATE
      SET next_value = greatest(resource_prefixes.next_value, excluded.next_value)`);
  }
};

/** Only collision keys touched by this write are examined. Ordinary saves never scan the owner. */
export const numberCollisions = async (tx: Transaction, owner: StorageOwner, records: StorageRecord[]) => {
  if (owner.extensionId !== coreOwnerId) return [];
  const keys = [
    ...new Map(
      records
        .filter(isNumberRecord)
        .map(numberValue)
        .map((r) => [JSON.stringify([r.extensionId, r.kind, r.prefix, r.value]), r]),
    ).values(),
  ];
  const rows: (typeof identities.$inferSelect)[] = [];
  for (const batch of jsonBatches(
    keys.map((r) => ({ extension_id: r.extensionId, kind: r.kind, shorthand: `${r.prefix}-${r.value}` })),
  )) {
    const result = await tx.execute(sql`SELECT i.* FROM resource_numbers i
      INNER JOIN (SELECT DISTINCT extension_id, kind, shorthand FROM jsonb_to_recordset(${batch}::jsonb)
        AS k(extension_id text, kind text, shorthand text)) k
      USING (extension_id, kind, shorthand)
      WHERE i.current AND i.project_id = ${owner.workbenchId}
      AND EXISTS (SELECT 1 FROM resource_numbers other
        WHERE other.current AND other.project_id = i.project_id AND other.extension_id = i.extension_id
        AND other.kind = i.kind AND other.shorthand = i.shorthand
        AND other.resource_id COLLATE "C" < i.resource_id COLLATE "C")
      ORDER BY i.resource_id COLLATE "C"`);
    rows.push(...(result.rows as typeof rows));
  }
  return [...new Map(rows.map((row) => [row.resource_id, row])).values()].sort((a, b) =>
    a.resource_id < b.resource_id ? -1 : 1,
  );
};
