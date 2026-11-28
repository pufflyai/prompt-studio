import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { releasedJournalDocument } from "./local-upgrade-documents";
import { prepareReleasedSaveReceipts } from "./released-save-receipts";
import * as schema from "./schemas.pg";

export const pendingOperation = "settled_epoch IS NULL AND (envelope IS NOT NULL OR admission IS NOT NULL)";
const pendingRecord = "(workbench_id,extension_id,record_id) IN (SELECT * FROM pg_temp.reimport_pending_records)";
const neededOperation =
  "(workbench_id,extension_id,operation_id) IN (SELECT * FROM pg_temp.reimport_needed_operations)";
export const neededDocument =
  "(workbench_id,extension_id,document_id) IN (SELECT * FROM pg_temp.reimport_needed_documents)";

export const partialTables = new Map([
  ["storage_current_records", pendingRecord],
  ["storage_ordered_records", pendingRecord],
  ["storage_ordered_operations", neededOperation],
  ["storage_ordered_touches", neededOperation],
  ["storage_ordered_receipts", neededOperation],
]);

// The ordinary converter owns the dependencies and receipt roots needed to reconstruct a local
// edit. Use its selection on the read-only source, with its disposable snapshot in the candidate.
export async function stagePendingRecords(source: PGlite, candidate: string) {
  const db = drizzle(source, { schema });
  const receipts = await prepareReleasedSaveReceipts(db, join(candidate, "queue"), true);
  if (!receipts) throw new Error("Missing released queue during batch re-import");
  try {
    await db.execute(sql`CREATE TEMP TABLE reimport_ordered_owners AS ${receipts.owners}`);
    await db.execute(sql`CREATE TEMP TABLE reimport_needed_operations AS
      SELECT workbench_id,extension_id,operation_id FROM storage_ordered_operations WHERE ${receipts.operations}`);
    await db.execute(sql`CREATE TEMP TABLE reimport_needed_documents AS
      SELECT workbench_id,extension_id,document_id FROM storage_documents WHERE
        ${sql.raw(releasedJournalDocument("document_id"))} AND ${receipts.documents}
        AND (workbench_id,extension_id) IN (SELECT workbench_id,extension_id FROM upgrade_pending_owners)`);
    await source.exec(`CREATE TEMP TABLE reimport_pending_records AS
      SELECT DISTINCT t.workbench_id,t.extension_id,t.record_id FROM storage_ordered_touches t
      JOIN storage_ordered_operations o USING(workbench_id,extension_id,operation_id) WHERE ${pendingOperation};
      ALTER TABLE reimport_pending_records ADD PRIMARY KEY (workbench_id,extension_id,record_id);
      ANALYZE reimport_pending_records; ANALYZE reimport_needed_operations; ANALYZE reimport_needed_documents`);
  } finally {
    await receipts.complete();
  }
}
