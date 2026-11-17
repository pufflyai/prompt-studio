import { type SQL, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { fingerprint, type Json, type StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_record_indexes } from "../../db/schemas.pg";
import { formatCacheSource } from "./record-format-key";
import { encodeProjectionValue } from "./record-projection-codec";
import { arrayIndexFields, recordFieldSql, recordIndexKeys, recordScopeSql } from "./record-query-sql";

export const dropRecordIndexes = async (db: Pick<DbClient, "select" | "execute">, where: SQL) => {
  const indexes = await db.select().from(storage_record_indexes).where(where);
  for (const index of indexes) {
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(index.database_name)}`);
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_o`)}`);
    for (const [position] of arrayIndexFields(index.definition).entries())
      await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_g${position}`)}`);
    for (const position of (index.definition.equality ?? []).keys()) {
      await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_e${position}`)}`);
      await db.execute(sql`DROP STATISTICS IF EXISTS ${sql.identifier(`${index.database_name}_s${position}`)}`);
    }
  }
};

export const recordIndexName = async (owner: StorageOwner, index: StorageRecordIndex) =>
  `storage_query_v3_${(await fingerprint({ owner: { ...owner }, definition: index as unknown as Json })).slice(0, 32)}`;

export const installRecordIndex = async (
  tx: Pick<DbClient, "execute" | "insert">,
  owner: StorageOwner,
  index: StorageRecordIndex,
) => {
  const name = await recordIndexName(owner, index);
  const keys = formatCacheSource(index.name) ? [] : recordIndexKeys(index);
  if (keys.length) {
    await tx.execute(
      sql`CREATE INDEX ${sql.identifier(name)} ON storage_current_records (${sql.join(keys, sql`, `)}) WHERE ${recordScopeSql(owner, { ...index, identity: undefined })}`,
    );
    // Postgres ignores partial-index statistics when estimating rows. Without these,
    // an in-list looks like half the owner and the planner scans every row.
    const localEqualityCount = (index.equality ?? []).filter(
      (field) =>
        !index.fields[field].lookup &&
        field !== index.identity?.shorthandField &&
        field !== index.hierarchy?.breadcrumbField,
    ).length;
    const orderKeys = recordIndexKeys({ ...index, equality: [] });
    // Equality prefixes cannot serve an unfiltered ordered page. Retain
    // point lookups and give LIMIT a separate path through the sort keys.
    if (localEqualityCount && orderKeys.length > 1)
      await tx.execute(
        sql`CREATE INDEX ${sql.identifier(`${name}_o`)} ON storage_current_records (${sql.join(orderKeys, sql`, `)}) WHERE ${recordScopeSql(owner, { ...index, identity: undefined })}`,
      );
    for (const [position, key] of keys.slice(0, localEqualityCount).entries()) {
      // A composite key only seeks its leading equality field. Preserve ordered seeks
      // when a filter names another declared equality field without fixing that prefix.
      if (position > 0)
        await tx.execute(
          sql`CREATE INDEX ${sql.identifier(`${name}_e${position}`)} ON storage_current_records (${key}, ${sql.join(orderKeys, sql`, `)}) WHERE ${recordScopeSql(owner, { ...index, identity: undefined })}`,
        );
      await tx.execute(
        sql`CREATE STATISTICS ${sql.identifier(`${name}_s${position}`)} ON ${key} FROM storage_current_records`,
      );
    }
    for (const [position, [field]] of arrayIndexFields(index).entries())
      await tx.execute(
        sql`CREATE INDEX ${sql.identifier(`${name}_g${position}`)} ON storage_current_records USING gin ((${recordFieldSql(index, field)})) WHERE ${recordScopeSql(owner, { ...index, identity: undefined })}`,
      );
  }
  await tx.insert(storage_record_indexes).values({
    workbench_id: owner.workbenchId,
    extension_id: owner.extensionId,
    name: index.name,
    database_name: name,
    definition: encodeProjectionValue(index as unknown as Json) as unknown as StorageRecordIndex,
  });
};
