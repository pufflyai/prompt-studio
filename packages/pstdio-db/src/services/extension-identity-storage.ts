import { type SQLWrapper, sql } from "drizzle-orm";
import type { DbClient } from "../db/connection.pglite";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
// Text files have independent histories. Any other owner state needs explicit conflict resolution.
const otherStorage = [
  "storage_ordered_records",
  "storage_ordered_operations",
  "storage_ordered_receipts",
  "file_projections",
  "log_streams",
  "history_rows",
  "history_sources",
  "asset_transfers",
  "recovery_point_owners",
];
export const textOnlyOwnerSql = (alias: string) => {
  const owner = sql.identifier(alias);
  return sql`${owner}.history_cursor IS NULL AND NOT ${owner}.history_migrated
    AND ${owner}.record_indexes = '{}'::jsonb
    AND ${owner}.revision = 0 AND ${owner}.numbers_revision = 0 AND ${owner}.live_count = 0
    AND ${owner}.epoch IS NULL AND NOT ${owner}.joined AND ${owner}.after = 0
    AND ${owner}.state_id IS NULL AND ${owner}.through = 0 AND ${owner}.pending_bytes = 0
    AND ${owner}.state_bytes = 0 AND NOT ${owner}.skipped AND ${owner}.receipt_root IS NULL
    AND NOT EXISTS (SELECT 1 FROM storage_current_records r WHERE r.owner_id=${owner}.id)
    AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.owner_id=${owner}.id
      AND (d.kind <> 'shared' OR NOT starts_with(d.key, '["text-file",')))
    AND NOT EXISTS (SELECT 1 FROM resource_links l WHERE l.source_owner=${owner}.id OR l.target_owner=${owner}.id)
    AND ${sql.join(
      otherStorage.map(
        (table) => sql`NOT EXISTS (SELECT 1 FROM ${sql.identifier(table)} child WHERE child.owner_id=${owner}.id)`,
      ),
      sql` AND `,
    )}`;
};
export const availableIdentityProject = (project: SQLWrapper, excluded: readonly string[]) =>
  excluded.length
    ? sql`(${project} IS NULL OR ${project} NOT IN (${sql.join(
        excluded.map((id) => sql`${id}`),
        sql`, `,
      )}))`
    : sql`true`;

export const mergeTextOwnerHistories = async (
  tx: Transaction,
  from: string,
  to: string,
  excluded: readonly string[] = [],
) => {
  const { rows } = await tx.execute<{ previous: number; canonical: number }>(sql`
    SELECT a.id AS previous,b.id AS canonical FROM owners a JOIN owners b USING (project_id)
    WHERE a.extension_id=${from} AND b.extension_id=${to}
      AND ${availableIdentityProject(sql`a.project_id`, excluded)}`);
  for (const { previous, canonical } of rows) {
    await tx.execute(sql`UPDATE documents SET owner_id=${canonical} WHERE owner_id=${previous}`);
    await tx.execute(sql`DELETE FROM owners WHERE id=${previous}`);
  }
};
