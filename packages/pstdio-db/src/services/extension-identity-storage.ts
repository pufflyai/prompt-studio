import { sql } from "drizzle-orm";
import type { DbClient } from "../db/connection.pglite";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
// Text files have independent histories. Any other owner state needs explicit conflict resolution.
const otherStorage = [
  "storage_record_indexes",
  "storage_resource_projections",
  "storage_ordered_owners",
  "native_document_sources",
  "native_document_file_projections",
  "log_streams",
  "history_rows",
  "history_sources",
  "asset_transfers",
  "recovery_point_owners",
];
export const textOnlyOwnerSql = (alias: string) => {
  const owner = sql.identifier(alias);
  return sql`${owner}.history_cursor IS NULL AND NOT ${owner}.history_migrated
    AND ${owner}.revision = 0 AND ${owner}.live_count = 0
    AND NOT EXISTS (SELECT 1 FROM storage_current_records r WHERE r.owner_id=${owner}.id)
    AND NOT EXISTS (SELECT 1 FROM storage_documents d WHERE d.owner_id=${owner}.id
      AND NOT starts_with(d.document_id, '["text-file",'))
    AND NOT EXISTS (SELECT 1 FROM resource_links l WHERE l.source_owner=${owner}.id OR l.target_owner=${owner}.id)
    AND ${sql.join(
      otherStorage.map(
        (table) => sql`NOT EXISTS (SELECT 1 FROM ${sql.identifier(table)} child WHERE child.owner_id=${owner}.id)`,
      ),
      sql` AND `,
    )}`;
};
export const mergeTextOwnerHistories = async (tx: Transaction, from: string, to: string) => {
  const { rows } = await tx.execute<{ previous: number; canonical: number }>(sql`
    SELECT a.id AS previous,b.id AS canonical FROM owners a JOIN owners b USING (project_id)
    WHERE a.extension_id=${from} AND b.extension_id=${to}`);
  for (const { previous, canonical } of rows) {
    await tx.execute(sql`INSERT INTO storage_documents (owner_id,document_id,state,revision,folded_revision)
      SELECT ${canonical},document_id,state,revision,folded_revision FROM storage_documents WHERE owner_id=${previous}`);
    for (const table of ["storage_document_updates", "storage_document_operations"])
      await tx.execute(sql`UPDATE ${sql.identifier(table)} SET owner_id=${canonical} WHERE owner_id=${previous}`);
    await tx.execute(sql`DELETE FROM owners WHERE id=${previous}`);
  }
};
