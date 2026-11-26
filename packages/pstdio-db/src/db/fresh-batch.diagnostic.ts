import assert from "node:assert/strict";
import { open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import { createDb, resolvePgliteOptions } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { openPglite } from "./open-pglite";
import * as schema from "./schemas.pg";
import { writeTrialRecords } from "./trial-record-stream";

const home = process.argv[2]!,
  src = join(home, "source"),
  dst = join(home, "pstdio.db");
await rename(dst, src);
const start = performance.now(),
  mark = (s: string) => console.log(s, Math.round(performance.now() - start));
const old = await openPglite(src, await resolvePgliteOptions());
await old.waitReady;
const released = await createTextLogOwnerFixture(home);
let releasedClosed = false,
  target: Awaited<ReturnType<typeof createDb>> | undefined;
const name = (n: string) => `"${n.replaceAll('"', '""')}"`;
const sourceFile = join(src, "batch-export.copy");
const omitted = new Set([
  "storage_current_records",
  "storage_ordered_records",
  "asset_transfers",
  "storage_document_operations",
  "storage_ordered_operations",
  "storage_ordered_touches",
  "storage_ordered_receipts",
]);
try {
  const [state] = (
    await old.query<{
      pending: boolean;
    }>(`SELECT EXISTS(SELECT 1 FROM storage_ordered_operations WHERE settled_epoch IS NULL AND (envelope IS NOT NULL OR admission IS NOT NULL))
    OR EXISTS(SELECT 1 FROM storage_record_outbox) OR EXISTS(SELECT 1 FROM storage_documents WHERE document_id='["ordered-conversion"]')
    OR EXISTS(SELECT 1 FROM storage_record_projections c WHERE NOT EXISTS(SELECT 1 FROM storage_ordered_owners o WHERE (c.workbench_id,c.extension_id)=(o.workbench_id,o.extension_id))) AS pending`)
  ).rows;
  assert.equal(state?.pending, false);
  const { rows: tables } = await old.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const docFilter = `document_id NOT LIKE '["ordered-dependency",%' AND document_id NOT LIKE '["ordered-index-blob",%'
  AND (NOT starts_with(document_id,'["resource",') OR (workbench_id,extension_id) NOT IN (SELECT o.workbench_id,o.extension_id FROM storage_ordered_owners o WHERE NOT EXISTS(SELECT 1 FROM storage_documents d WHERE d.workbench_id=o.workbench_id AND d.extension_id=o.extension_id AND d.document_id IN ('["ordered-conversion"]','resource-identities'))))`;
  const smallFile = join(released.path, "batch-import.copy");
  let imported = 0;
  await released.pglite.exec("BEGIN; SET LOCAL session_replication_role=replica");
  for (const { tablename } of tables) {
    if (omitted.has(tablename)) continue;
    const table = name(tablename);
    const where = ["storage_documents", "storage_document_updates"].includes(tablename) ? ` WHERE ${docFilter}` : "";
    const [row] = (await old.query<{ present: boolean }>(`SELECT EXISTS(SELECT 1 FROM ${table}${where}) AS present`))
      .rows;
    if (!row.present) continue;
    await (await open(sourceFile, "wx", 0o600)).close();
    await old.exec(`COPY (SELECT * FROM ${table}${where}) TO '/pglite/data/batch-export.copy' WITH (FORMAT binary)`);
    await rename(sourceFile, smallFile);
    // The empty released schema may have seeded rows of its own. The archive is authoritative here.
    await released.pglite.exec(
      `DELETE FROM ${table}; COPY ${table} FROM '/pglite/data/batch-import.copy' WITH (FORMAT binary)`,
    );
    await rm(smallFile);
    imported++;
  }
  // Copy sequence positions, including numbers consumed by expired operations.
  const seqs = (
    await old.query<{ sequencename: string }>("SELECT sequencename FROM pg_sequences WHERE schemaname='public'")
  ).rows;
  for (const { sequencename } of seqs) {
    const v = (
      await old.query<{ last_value: string; is_called: boolean }>(
        `SELECT last_value::text,is_called FROM ${name(sequencename)}`,
      )
    ).rows[0]!;
    await released.pglite.query("SELECT setval($1::regclass,$2::bigint,$3::boolean)", [
      sequencename,
      v.last_value,
      v.is_called,
    ]);
  }
  await released.pglite.exec("UPDATE storage_ordered_owners SET receipt_root=NULL; COMMIT");
  await released.close();
  releasedClosed = true;
  await rename(released.path, dst);
  mark("small_tables_exported_and_loaded_ms");
  console.log("nonempty_small_tables", imported);
  target = await createDb({ path: dst, deferCleanup: true });
  const db = target.pglite;
  mark("small_database_converted_ms");
  const { rows: owners } = await old.query<{ project_id: string; extension_id: string }>(
    "SELECT workbench_id AS project_id,extension_id FROM storage_ordered_owners UNION SELECT project_id,extension_id FROM asset_transfers",
  );
  const named = owners.map((o) => ({ ...o, current: canonicalExtensionId(o.extension_id) }));
  await db.query(
    "INSERT INTO owners(project_id,extension_id) SELECT DISTINCT project_id,current FROM jsonb_to_recordset($1::jsonb) AS x(project_id text,current text) ON CONFLICT DO NOTHING",
    [JSON.stringify(named)],
  );
  const { rows: keys } = await db.query(
    "SELECT o.id,x.project_id,x.extension_id FROM jsonb_to_recordset($1::jsonb) AS x(project_id text,extension_id text,current text) JOIN owners o ON o.project_id=x.project_id AND o.extension_id=x.current",
    [JSON.stringify(named)],
  );
  await old.exec("CREATE TEMP TABLE owners(id int,project_id text,extension_id text)");
  await old.query(
    "INSERT INTO owners SELECT id,project_id,extension_id FROM jsonb_to_recordset($1::jsonb) AS x(id int,project_id text,extension_id text)",
    [JSON.stringify(keys)],
  );
  const transfers = join(src, "transfers.copy");
  await (await open(transfers, "wx", 0o600)).close();
  await old.exec(
    "COPY (SELECT o.id,t.operation_id,t.expected,t.cancelled_at::timestamptz,t.created_at::timestamptz FROM public.asset_transfers t JOIN owners o USING(project_id,extension_id)) TO '/pglite/data/transfers.copy' WITH (FORMAT binary)",
  );
  await rename(transfers, join(dst, "transfers.copy"));
  const file = join(dst, "records.copy");
  await writeTrialRecords(drizzle(old, { schema }), file, "public");
  mark("large_binary_exports_ready_ms");
  await db.exec(`BEGIN; SET LOCAL maintenance_work_mem='96MB'; SET LOCAL work_mem='32MB';
   ALTER TABLE asset_transfers DROP CONSTRAINT asset_transfers_owner_id_owners_id_fk,DROP CONSTRAINT asset_transfers_owner_id_operation_id_pk;
   ALTER TABLE records DROP CONSTRAINT records_owner_id_owners_id_fk,DROP CONSTRAINT records_owner_id_record_id_pk;
   DROP INDEX records_native_sources_idx;
   COPY records(owner_id,record_id,deleted,value,query_values,asset,shared,native_sources,native_versions,record_lifetime,revision,meta,base) FROM '/pglite/data/records.copy' WITH (FORMAT binary);
   COPY asset_transfers(owner_id,operation_id,expected,cancelled_at,created_at) FROM '/pglite/data/transfers.copy' WITH (FORMAT binary);
   ALTER TABLE records ADD CONSTRAINT records_owner_id_record_id_pk PRIMARY KEY(owner_id,record_id),
    ADD CONSTRAINT records_owner_id_owners_id_fk FOREIGN KEY(owner_id) REFERENCES owners(id) ON DELETE CASCADE;
   CREATE INDEX records_native_sources_idx ON records USING gin(native_sources);
   ALTER TABLE asset_transfers ADD CONSTRAINT asset_transfers_owner_id_operation_id_pk PRIMARY KEY(owner_id,operation_id),
    ADD CONSTRAINT asset_transfers_owner_id_owners_id_fk FOREIGN KEY(owner_id) REFERENCES owners(id) ON DELETE CASCADE;
   COMMIT`);
  await rm(file);
  await rm(join(dst, "transfers.copy"));
  await target.close();
  target = undefined;
  mark("committed_and_closed_ms");
} finally {
  if (!releasedClosed) await released.close();
  await target?.close();
  await old.close();
}
