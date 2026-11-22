import { type SQL, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { fingerprint, type Json, type StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { dropCountIndex, installCountIndex } from "./record-count-index";
import { saveRecordIndexRow, recordIndexRows as storage_record_indexes } from "./record-index-rows";
import { encodeProjectionValue } from "./record-projection-codec";
import { arrayIndexFields, recordFieldSql, recordIndexKeys, recordScopeSql } from "./record-query-sql";
import { ensureStorageOwner } from "./storage-owner-key";

export const dropRecordIndexObjects = async (
  db: Pick<DbClient, "execute">,
  indexes: { definition: StorageRecordIndex; database_name: string }[],
) => {
  for (const index of indexes) {
    const countedLayout = index.database_name.startsWith("storage_query_v4_");
    if (countedLayout) await dropCountIndex(db, index.definition, index.database_name);
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(index.database_name)}`);
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_o`)}`);
    for (const position of (countedLayout ? (index.definition.alternateOrders ?? []) : []).keys())
      await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_a${position}`)}`);
    for (const [position] of arrayIndexFields(index.definition).entries())
      await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_g${position}`)}`);
    for (const position of (index.definition.equality ?? []).keys()) {
      await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_e${position}`)}`);
      await db.execute(sql`DROP STATISTICS IF EXISTS ${sql.identifier(`${index.database_name}_s${position}`)}`);
    }
  }
};

export const dropRecordIndexes = async (db: Pick<DbClient, "select" | "execute">, where: SQL) =>
  dropRecordIndexObjects(
    db,
    await db
      .select({ definition: storage_record_indexes.definition, database_name: storage_record_indexes.database_name })
      .from(storage_record_indexes)
      .where(where),
  );

export const recordIndexName = async (
  owner: StorageOwner & { ownerId?: number; coreOwnerId?: number | null },
  index: StorageRecordIndex,
) =>
  `storage_query_${index.countBy?.length || index.alternateOrders?.length ? "v4" : "v3"}_${(await fingerprint({ owner: { workbenchId: owner.workbenchId, extensionId: owner.extensionId, ownerId: owner.ownerId ?? null }, coreOwnerId: index.identity ? (owner.coreOwnerId ?? null) : null, integerOwner: "v1", definition: index as unknown as Json, recordIdentityOrder: "prefix-v1" })).slice(0, 32)}`;

export const installRecordIndex = async (
  tx: Pick<DbClient, "execute" | "insert" | "select">,
  owner: StorageOwner,
  index: StorageRecordIndex,
) => {
  const ownerId = await ensureStorageOwner(tx, owner);
  const coreOwnerId = index.identity ? await ensureStorageOwner(tx, { ...owner, extensionId: "pstdio" }) : null;
  const physical = { ...owner, ownerId, coreOwnerId };
  const name = await recordIndexName(physical, index);
  const keys = recordIndexKeys(index);
  if (keys.length) {
    await tx.execute(
      sql`CREATE INDEX ${sql.identifier(name)} ON records (${sql.join(keys, sql`, `)}) WHERE ${recordScopeSql(physical, { ...index, identity: undefined })}`,
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
    if (localEqualityCount && orderKeys.length)
      await tx.execute(
        sql`CREATE INDEX ${sql.identifier(`${name}_o`)} ON records (${sql.join(orderKeys, sql`, `)}) WHERE ${recordScopeSql(physical, { ...index, identity: undefined })}`,
      );
    for (const [position, key] of keys.slice(0, localEqualityCount).entries()) {
      // A composite key only seeks its leading equality field. Preserve ordered seeks
      // when a filter names another declared equality field without fixing that prefix.
      if (position > 0)
        await tx.execute(
          sql`CREATE INDEX ${sql.identifier(`${name}_e${position}`)} ON records (${key}, ${sql.join(orderKeys, sql`, `)}) WHERE ${recordScopeSql(physical, { ...index, identity: undefined })}`,
        );
      await tx.execute(sql`CREATE STATISTICS ${sql.identifier(`${name}_s${position}`)} ON ${key} FROM records`);
    }
    for (const [position, orderBy] of (index.alternateOrders ?? []).entries()) {
      const keys = recordIndexKeys({ ...index, equality: [], orderBy });
      await tx.execute(
        sql`CREATE INDEX ${sql.identifier(`${name}_a${position}`)} ON records (${sql.join(keys, sql`, `)}) WHERE ${recordScopeSql(physical, { ...index, identity: undefined })}`,
      );
    }
    for (const [position, [field]] of arrayIndexFields(index).entries())
      await tx.execute(
        sql`CREATE INDEX ${sql.identifier(`${name}_g${position}`)} ON records USING gin ((${recordFieldSql(index, field)})) WHERE ${recordScopeSql(physical, { ...index, identity: undefined })}`,
      );
  }
  await installCountIndex(tx, physical, index, name);
  await saveRecordIndexRow(tx, {
    owner_id: ownerId,
    name: index.name,
    database_name: name,
    definition: encodeProjectionValue(index as unknown as Json) as unknown as StorageRecordIndex,
  });
};
