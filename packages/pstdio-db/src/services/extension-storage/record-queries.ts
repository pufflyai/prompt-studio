import { and, eq, inArray, sql } from "drizzle-orm";
import {
  encodeQueryCursor,
  prepareRecordQuery,
  type StorageOwner,
  validateIndexes,
  validatePredicate,
} from "pstdio-sync";
import {
  fingerprint,
  type Json,
  type StorageRecord,
  type StorageRecordIndex,
  type StorageRecordQueries,
} from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_current_records as current,
  storage_record_indexes as indexes,
  storage_record_projections as projections,
  storage_documents,
} from "../../db/schemas.pg";
import {
  arrayIndexFields,
  pageAfterSql,
  pageOrderSql,
  predicateSql,
  recordFieldSql,
  recordIndexKeys,
  sortFieldSql,
  sqlLiteral,
} from "./record-query-sql";
import type { StorageDiagnostics } from "./storage-diagnostics";

type QueryRow = { record_id: string; revision: string; fields: Record<string, Json>; sort_values: Json[] };
type Current = typeof current.$inferSelect;
const missingRecord = async (recordId: string) => ({
  recordId,
  exists: false,
  deleted: false,
  value: null,
  asset: null,
  shared: null,
  revision: await fingerprint({ value: null, asset: null, shared: null, deleted: false }),
});
const asRecord = (row: Current) =>
  ({
    recordId: row.record_id,
    exists: true,
    deleted: row.deleted,
    value: row.value ?? null,
    asset: row.asset,
    shared: row.shared,
    revision: row.revision,
  }) satisfies StorageRecord;

export const createRecordQueries = (
  db: DbClient,
  owner: StorageOwner,
  rebuild: () => Promise<void>,
  diagnostics?: StorageDiagnostics,
) => {
  const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId };
  const ownerWhere = (table: typeof current | typeof indexes | typeof projections) =>
    and(eq(table.workbench_id, owner.workbenchId), eq(table.extension_id, owner.extensionId));
  const ownerSql = sql`workbench_id = ${sqlLiteral(owner.workbenchId)} AND extension_id = ${sqlLiteral(owner.extensionId)}`;
  const visible = (index: StorageRecordIndex) =>
    sql`${ownerSql} AND NOT deleted ${index.prefix === undefined ? sql`` : sql`AND starts_with(record_id, ${sqlLiteral(index.prefix)})`}`;
  const getIndex = async (connection: Pick<DbClient, "select">, name: string) => {
    const [index] = await connection
      .select()
      .from(indexes)
      .where(and(ownerWhere(indexes), eq(indexes.name, name)));
    if (!index) throw new Error(`Storage index not installed: ${name}`);
    return index.definition;
  };
  const getRevision = async (connection: Pick<DbClient, "select">) => {
    const [projection] = await connection.select().from(projections).where(ownerWhere(projections));
    if (!projection) {
      const [document] = await connection
        .select({ revision: storage_documents.revision })
        .from(storage_documents)
        .where(
          and(
            eq(storage_documents.workbench_id, owner.workbenchId),
            eq(storage_documents.extension_id, owner.extensionId),
            eq(storage_documents.document_id, "records"),
          ),
        );
      if (!document) return "0";
      throw new Error("Storage projection is unavailable; install or upgrade its indexes");
    }
    return String(projection.revision);
  };
  const api: StorageRecordQueries = {
    defineIndexes: async (definitions) => {
      validateIndexes(definitions);
      const desired = structuredClone(definitions).sort((a, b) => (a.name < b.name ? -1 : Number(a.name > b.name)));
      const previous = await db.select().from(indexes).where(ownerWhere(indexes)).orderBy(indexes.name);
      if (!desired.length && !previous.length) return;
      const [ready] = await db.select().from(projections).where(ownerWhere(projections));
      if (
        ready &&
        (await fingerprint(previous.map((row) => row.definition) as unknown as Json)) ===
          (await fingerprint(desired as unknown as Json))
      )
        return;
      await rebuild();
      await db.transaction(async (tx) => {
        for (const index of previous) {
          await tx.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(index.database_name)}`);
          for (const [position] of arrayIndexFields(index.definition).entries())
            await tx.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(`${index.database_name}_g${position}`)}`);
        }
        await tx.delete(indexes).where(ownerWhere(indexes));
        for (const index of desired) {
          const name = `storage_query_${(await fingerprint({ owner: { ...owner }, definition: index as unknown as Json })).slice(0, 32)}`;
          const keys = recordIndexKeys(index);
          await tx.execute(
            sql`CREATE INDEX ${sql.identifier(name)} ON storage_current_records (${sql.join(keys, sql`, `)}) WHERE ${visible(index)}`,
          );
          for (const [position, [field]] of arrayIndexFields(index).entries())
            await tx.execute(
              sql`CREATE INDEX ${sql.identifier(`${name}_g${position}`)} ON storage_current_records USING gin ((${recordFieldSql(index, field)})) WHERE ${visible(index)}`,
            );
          await tx.insert(indexes).values({ ...address, name: index.name, database_name: name, definition: index });
        }
      });
    },
    query: (query) =>
      db.transaction(async (tx) => {
        const index = await getIndex(tx, query.index);
        const revision = await getRevision(tx);
        const page = await prepareRecordQuery(owner, index, query, revision);
        const selected = page.fields.flatMap((name) => [
          sqlLiteral(name),
          sql`coalesce(${recordFieldSql(index, name)}, 'null'::jsonb)`,
        ]);
        const sort = (index.orderBy ?? []).map(
          (sort) => sql`coalesce(${sortFieldSql(index, sort.field)}, 'null'::jsonb)`,
        );
        const result = await tx.execute<QueryRow>(sql`
        SELECT record_id, revision,
          jsonb_build_object(${sql.join(selected, sql`, `)}) AS fields,
          jsonb_build_array(${sql.join(sort, sql`, `)}) AS sort_values
        FROM storage_current_records
        WHERE ${visible(index)} AND ${predicateSql(index, query.where)} AND ${pageAfterSql(index, page.after)}
        ORDER BY ${pageOrderSql(index)} LIMIT ${page.limit}`);
        const last = result.rows.at(-1);
        let cursor: string | null = null;
        if (last && result.rows.length === page.limit) {
          const after = { recordId: last.record_id, values: last.sort_values };
          const next = await tx.execute(
            sql`SELECT 1 FROM storage_current_records WHERE ${visible(index)} AND ${predicateSql(index, query.where)} AND ${pageAfterSql(index, after)} LIMIT 1`,
          );
          if (next.rows.length) cursor = encodeQueryCursor({ ...after, identity: page.identity, revision });
        }
        diagnostics?.({ phase: "records-queried", owner, records: result.rows.length });
        return {
          revision,
          cursor,
          records: result.rows.map((row) => ({ recordId: row.record_id, revision: row.revision, fields: row.fields })),
        };
      }),
    aggregate: (query) =>
      db.transaction(async (tx) => {
        const index = await getIndex(tx, query.index);
        const revision = await getRevision(tx);
        validatePredicate(index, query.where);
        const group =
          query.groupBy === undefined
            ? sql`NULL::jsonb`
            : sql`coalesce(${recordFieldSql(index, query.groupBy)}, 'null'::jsonb)`;
        const result = await tx.execute<{ value: Json; count: string }>(
          sql`SELECT ${group} AS value, count(*)::text AS count FROM storage_current_records WHERE ${visible(index)} AND ${predicateSql(index, query.where)} GROUP BY 1 ORDER BY 1 NULLS LAST`,
        );
        return {
          revision,
          count: result.rows.reduce((sum, row) => sum + Number(row.count), 0),
          groups:
            query.groupBy === undefined
              ? []
              : result.rows.map((row) => ({ value: row.value ?? null, count: Number(row.count) })),
        };
      }),
    readMany: async (ids) => {
      if (ids.length > 100) throw new Error("A batch can read at most 100 records");
      if (!ids.length) return [];
      await getRevision(db);
      const rows = await db
        .select()
        .from(current)
        .where(and(ownerWhere(current), inArray(current.record_id, ids)));
      const byId = new Map(rows.map((row) => [row.record_id, asRecord(row)]));
      return Promise.all(ids.map((id) => byId.get(id) ?? missingRecord(id)));
    },
  };
  return {
    ...api,
    hasProjection: async () => (await db.select().from(projections).where(ownerWhere(projections))).length > 0,
  };
};
