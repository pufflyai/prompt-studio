import { type SQL, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { storage_record_indexes } from "../../db/schemas.pg";
import { arrayIndexFields } from "./record-query-sql";

export const dropRecordIndexes = async (db: Pick<DbClient, "select" | "execute">, where: SQL) => {
  const indexes = await db.select().from(storage_record_indexes).where(where);
  for (const index of indexes) {
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(index.database_name)}`);
    for (const [position] of arrayIndexFields(index.definition).entries())
      await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_g${position}`)}`);
  }
};
