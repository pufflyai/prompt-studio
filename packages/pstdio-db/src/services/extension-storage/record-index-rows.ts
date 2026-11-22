import { eq, type SQL, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { owners } from "../../db/schemas/owners";

/** Query declarations directly from their owner, without a second persisted catalog. */
export const recordIndexRows = new QueryBuilder()
  .select({
    owner_id: sql<number>`${owners.id}`.as("owner_id"),
    name: sql<string>`entry.key`.as("name"),
    definition: sql<StorageRecordIndex>`entry.value->'definition'`.as("definition"),
    database_name: sql<string>`entry.value->>'database_name'`.as("database_name"),
  })
  .from(owners)
  .innerJoin(sql`jsonb_each(${owners.record_indexes}) AS entry(key,value)`, sql`true`)
  .as("record_index_rows");

export const saveRecordIndexRow = async (
  tx: Pick<DbClient, "execute">,
  row: { owner_id: number | SQL; name: string; definition: StorageRecordIndex; database_name: string },
) => {
  const { owner_id, name, ...value } = row;
  await tx.execute(sql`UPDATE owners SET record_indexes = record_indexes ||
    jsonb_build_object(${name}::text, ${JSON.stringify(value)}::jsonb) WHERE id=${owner_id}`);
};

export const deleteRecordIndexRows = async (tx: Pick<DbClient, "select" | "execute">, where: SQL) => {
  const rows = await tx
    .select({ ownerId: recordIndexRows.owner_id, name: recordIndexRows.name })
    .from(recordIndexRows)
    .where(where);
  const byOwner = new Map<number, string[]>();
  for (const row of rows) {
    const names = byOwner.get(row.ownerId) ?? [];
    names.push(row.name);
    byOwner.set(row.ownerId, names);
  }
  for (const [ownerId, names] of byOwner)
    await tx.execute(
      sql`UPDATE owners SET record_indexes = record_indexes - ARRAY[${sql.join(
        names.map((name) => sql`${name}`),
        sql`, `,
      )}]::text[] WHERE ${eq(owners.id, ownerId)}`,
    );
};
