import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { fingerprint, formatViewDate, type Json, type StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records as current, storage_record_indexes as indexes } from "../../db/schemas.pg";
import { formatCacheFields, formatCachePrefix, formatCacheSource, formatDatabasePrefix } from "./record-format-key";
import { decodeProjectionValue, encodeProjectionValue, projectionKey } from "./record-projection-codec";
import { recordFieldSql, recordScopeSql } from "./record-query-sql";
import type { StorageDiagnostics } from "./storage-diagnostics";
import { ensureStorageOwner, storageOwnerKey } from "./storage-owner-key";

export const retainDateFormatIndexes = async (installed: StorageRecordIndex[], desired: StorageRecordIndex[]) => {
  const signatures = new Map(
    await Promise.all(desired.map(async (index) => [index.name, await fingerprint(index as unknown as Json)] as const)),
  );
  return installed.filter((index) => {
    const source = formatCacheSource(index.name);
    return source && !signatures.has(index.name) && signatures.get(source[0]) === source[1];
  });
};

export const installDateFormatIndex = async (
  tx: Pick<DbClient, "insert" | "select">,
  owner: StorageOwner,
  index: StorageRecordIndex,
) => {
  const digest = await fingerprint(index.name);
  await tx.insert(indexes).values({
    owner_id: await ensureStorageOwner(tx, owner),
    name: index.name,
    database_name: `${formatDatabasePrefix}${digest.slice(0, 32)}`,
    definition: encodeProjectionValue(index as unknown as Json) as unknown as StorageRecordIndex,
  });
};

const findFormatSlot = async (
  tx: Pick<DbClient, "select">,
  owner: StorageOwner,
  identity: [string, string, string],
) => {
  const ownerWhere = and(eq(indexes.owner_id, storageOwnerKey(owner)));
  for (let slot = 0; ; slot++) {
    const name = formatCachePrefix + JSON.stringify(slot ? [...identity, slot] : identity);
    const [row] = await tx
      .select({ databaseName: indexes.database_name })
      .from(indexes)
      .where(and(ownerWhere, eq(indexes.name, name)));
    if (!row) return { name, exists: false };
    if (row.databaseName.startsWith(formatDatabasePrefix)) return { name, exists: true };
  }
};

/** A local formatting cache has one owner and is maintained from canonical values on every commit. */
export const prepareDateFormatIndexes = async (
  tx: Pick<DbClient, "select" | "execute" | "insert" | "delete">,
  owner: StorageOwner,
  declared: StorageRecordIndex,
  requested: StorageRecordIndex,
  diagnostics?: StorageDiagnostics,
) => {
  if (!Object.values(requested.fields).some((field) => field.format)) return;
  const signature = await fingerprint(declared as unknown as Json);
  for (const field of Object.values(requested.fields)) {
    if (!field.format) continue;
    const format = field.format;
    const { name, exists } = await findFormatSlot(tx, owner, [
      declared.name,
      signature,
      await fingerprint(format as unknown as Json),
    ]);
    formatCacheFields.set(field, name);
    if (exists) continue;
    // Cache only dates. Markdown bodies and unrelated fields never cross this backfill boundary.
    let after: string | undefined;
    for (;;) {
      const rows = await tx
        .select({ recordId: current.record_id, source: recordFieldSql(declared, format.field) })
        .from(current)
        .where(
          and(
            recordScopeSql(owner, { ...declared, identity: undefined }),
            after === undefined ? undefined : sql`${current.record_id} COLLATE "C" > ${after}`,
          ),
        )
        .orderBy(sql`${current.record_id} COLLATE "C"`)
        .limit(100);
      if (!rows.length) break;
      diagnostics?.({ phase: "format-index-records-read", owner, records: rows.length });
      const input = rows.map((row) => ({
        record_id: row.recordId,
        formatted: encodeProjectionValue(
          formatViewDate(decodeProjectionValue((row.source as Json) ?? null), format) ?? null,
        ),
      }));
      await tx.execute(sql`UPDATE storage_current_records AS target SET query_values = target.query_values || jsonb_build_object(${projectionKey(name)}::text, jsonb_build_object('value', input.formatted))
        FROM jsonb_to_recordset(${JSON.stringify(input)}::jsonb) AS input(record_id text, formatted jsonb)
        WHERE target.owner_id = ${storageOwnerKey(owner)} AND target.record_id = input.record_id`);
      after = rows.at(-1)!.recordId;
    }
    const definition: StorageRecordIndex = {
      name,
      prefix: declared.prefix,
      fields: {
        value: {
          path: ["source"],
          type: field.type,
          derive: {
            kind: "date",
            source: declared.fields[format.field],
            format: { locale: format.locale, timeZone: format.timeZone, part: format.part },
          },
        },
      },
    };
    await installDateFormatIndex(tx, owner, definition);
  }
};

/** Prune once all root and related formats have been prepared, preserving this query's entire working set. */
export const pruneDateFormatIndexes = async (
  tx: Pick<DbClient, "select" | "execute" | "delete">,
  owner: StorageOwner,
  requested: StorageRecordIndex[],
) => {
  const pinned = new Set(
    requested.flatMap((index) =>
      Object.values(index.fields).flatMap((field) => {
        const name = formatCacheFields.get(field);
        return name ? [name] : [];
      }),
    ),
  );
  if (!pinned.size) return;
  const ownerWhere = and(eq(indexes.owner_id, storageOwnerKey(owner)));
  const cached = await tx
    .select({ name: indexes.name })
    .from(indexes)
    .where(and(ownerWhere, sql`starts_with(${indexes.database_name}, ${formatDatabasePrefix})`))
    .orderBy(indexes.name);
  const evicted = cached
    .filter((entry) => !pinned.has(entry.name))
    .slice(0, Math.max(0, cached.length - 128))
    .map(({ name }) => name);
  if (evicted.length) {
    await tx.delete(indexes).where(and(ownerWhere, inArray(indexes.name, evicted)));
    await tx.execute(
      sql`UPDATE storage_current_records SET query_values = query_values - ARRAY[${sql.join(
        evicted.map((key) => sql`${projectionKey(key)}`),
        sql`, `,
      )}]::text[] WHERE owner_id = ${storageOwnerKey(owner)}`,
    );
  }
};
