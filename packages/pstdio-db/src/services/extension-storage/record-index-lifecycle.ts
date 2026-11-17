import { type SQL, sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_record_indexes } from "../../db/schemas.pg";
import { arrayIndexFields, recordFieldSql, recordIndexKeys } from "./record-query-sql";

export const createRecordIndex = async (
  db: Pick<DbClient, "execute">,
  name: string,
  index: StorageRecordIndex,
  where: SQL,
) => {
  const keys = recordIndexKeys(index);
  await db.execute(
    sql`CREATE INDEX ${sql.identifier(name)} ON storage_current_records (${sql.join(keys, sql`, `)}) WHERE ${where}`,
  );
  if (index.equality?.length)
    await db.execute(
      sql`CREATE INDEX ${sql.identifier(`${name}_o`)} ON storage_current_records (${sql.join(recordIndexKeys({ ...index, equality: [] }), sql`, `)}) WHERE ${where}`,
    );
  // Postgres ignores partial-index statistics when estimating rows. Without these,
  // an in-list looks like half the owner and the planner scans every row.
  for (const [position, key] of keys.slice(0, index.equality?.length ?? 0).entries())
    await db.execute(
      sql`CREATE STATISTICS ${sql.identifier(`${name}_s${position}`)} ON ${key} FROM storage_current_records`,
    );
  for (const [position, [field]] of arrayIndexFields(index).entries())
    await db.execute(
      sql`CREATE INDEX ${sql.identifier(`${name}_g${position}`)} ON storage_current_records USING gin ((${recordFieldSql(index, field)})) WHERE ${where}`,
    );
};

export const dropRecordIndexes = async (db: Pick<DbClient, "select" | "execute">, where: SQL) => {
  const indexes = await db.select().from(storage_record_indexes).where(where);
  for (const index of indexes) {
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(index.database_name)}`);
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_o`)}`);
    for (const [position] of arrayIndexFields(index.definition).entries())
      await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_g${position}`)}`);
    for (const position of (index.definition.equality ?? []).keys())
      await db.execute(sql`DROP STATISTICS IF EXISTS ${sql.identifier(`${index.database_name}_s${position}`)}`);
  }
};
