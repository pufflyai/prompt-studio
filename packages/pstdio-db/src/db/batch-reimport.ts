import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PGlite, PGliteOptions, Transaction } from "@electric-sql/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import {
  batchBackup,
  batchPayload,
  batchWork,
  beginBatchHome,
  recoverBatchHome,
  writeDurably,
} from "./batch-reimport-home";
import { exportSettledRecords, NeedsRecordAdmission } from "./batch-reimport-records";
import { stageLocalTransfers } from "./local-upgrade-transfers";
import { applyPgliteMigrations } from "./migrate-pglite";
import { openPglite } from "./open-pglite";
import { engineFile, flushDirectory } from "./pglite-home-recovery";
import { hasUpgradeSnapshots } from "./upgrade-snapshot";

const quote = (id: string) => `"${id.replaceAll('"', '""')}"`;
const recordFile = "records.copy";
const skipped = new Set([
  "storage_current_records",
  "storage_ordered_records",
  "storage_personal_history_sources",
  "storage_record_sync",
  "storage_record_outbox",
  "storage_ordered_operations",
  "storage_ordered_touches",
  "storage_ordered_receipts",
  "storage_document_operations",
]);
const retainedDocument = `NOT starts_with(document_id,'["ordered-')
  AND (NOT starts_with(document_id,'["resource",') OR (workbench_id,extension_id) NOT IN
    (SELECT o.workbench_id,o.extension_id FROM storage_ordered_owners o WHERE NOT EXISTS
      (SELECT 1 FROM storage_documents d WHERE d.workbench_id=o.workbench_id AND d.extension_id=o.extension_id
        AND d.document_id IN ('["ordered-conversion"]','resource-identities'))))`;

async function copyBinary(source: PGlite, path: string, select: string, destination: string) {
  const temporary = join(path, "pstdio-reimport-048.tmp");
  await (await open(temporary, "wx", 0o600)).close();
  try {
    await source.exec(`COPY (${select}) TO '/pglite/data/pstdio-reimport-048.tmp' WITH (FORMAT binary)`);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

// COPY each table after its parents so PostgreSQL checks every foreign key. Generated count-index
// tables are rebuilt from their declarations and restored records by the normal owner migration.
async function copySmallTables(source: PGlite, path: string, dest: PGlite, candidate: string, signal?: AbortSignal) {
  const tables = (
    await dest.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public'")
  ).rows.map((r) => r.tablename);
  const known = new Set(tables);
  const extras = (
    await source.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND NOT(tablename=ANY($1::text[])) AND NOT EXISTS (SELECT 1 FROM storage_record_indexes i
      WHERE tablename IN (i.database_name||'_c',i.database_name||'_i',i.database_name||'_r'))`,
      [tables],
    )
  ).rows;
  if (extras.length) throw new NeedsRecordAdmission("Database contains additional released tables");
  const deps = (
    await dest.query<{
      child: string;
      parent: string;
    }>(`SELECT conrelid::regclass::text child,confrelid::regclass::text parent
    FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND conrelid<>confrelid`)
  ).rows;
  const file = join(candidate, "batch-table.copy");
  await dest.transaction(async (tx) => {
    await tx.exec(`TRUNCATE ${tables.map(quote).join(",")}`);
    while (known.size) {
      const next = [...known].find((t) => !deps.some((d) => d.child === t && known.has(d.parent)));
      if (!next) throw new NeedsRecordAdmission("Released tables require cyclic foreign key admission");
      known.delete(next);
      if (skipped.has(next)) continue;
      signal?.throwIfAborted();
      const table = quote(next);
      let where = "";
      if (next === "asset_transfers")
        where =
          " WHERE cancelled_at IS NULL AND (project_id,extension_id,operation_id) IN (SELECT * FROM pg_temp.local_upgrade_transfers)";
      if (["storage_documents", "storage_document_updates"].includes(next)) where = ` WHERE ${retainedDocument}`;
      if (
        !(await source.query<{ present: boolean }>(`SELECT EXISTS(SELECT 1 FROM ${table}${where}) AS present`)).rows[0]!
          .present
      )
        continue;
      await copyBinary(source, path, `SELECT * FROM ${table}${where}`, file);
      await tx.exec(`COPY ${table} FROM '/pglite/data/batch-table.copy' WITH (FORMAT binary)`);
      await rm(file);
    }
    await tx.exec("UPDATE storage_ordered_owners SET receipt_root=NULL WHERE receipt_root IS NOT NULL");
    const sequences = (
      await source.query<{ sequencename: string }>("SELECT sequencename FROM pg_sequences WHERE schemaname='public'")
    ).rows;
    for (const { sequencename } of sequences) {
      const p = (
        await source.query<{ value: string; called: boolean }>(
          `SELECT last_value::text AS value,is_called AS called FROM ${quote(sequencename)}`,
        )
      ).rows[0]!;
      await tx.query("SELECT setval($1::regclass,$2::bigint,$3::boolean)", [sequencename, p.value, p.called]);
    }
  });
}

export async function stageBatchReimport(
  source: PGlite,
  path: string,
  options: PGliteOptions,
  folder: string,
  signal?: AbortSignal,
  storageRoot = join(dirname(path), "storage"),
) {
  if (
    existsSync(batchBackup(path)) ||
    existsSync(join(path, "pstdio-reimport-048.tmp")) ||
    (await hasUpgradeSnapshots(path))
  )
    return false;
  const journal = readMigrationFiles({ migrationsFolder: folder });
  const history = (
    await source.query<{ hash: string; created_at: string }>(
      "SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at",
    )
  ).rows;
  // 0.48 nightlies, stable and the preceding 0.49 nightly shipped journal prefixes 0007 through 0010.
  if (
    history.length < 8 ||
    history.length > 11 ||
    !history.every((r, i) => r.hash === journal[i]?.hash && Number(r.created_at) === journal[i]?.folderMillis)
  )
    return false;
  const [{ eligible }] = (
    await source.query<{ eligible: boolean }>(`SELECT EXISTS(SELECT 1 FROM storage_ordered_records)
    AND NOT EXISTS(SELECT 1 FROM storage_ordered_operations WHERE settled_epoch IS NULL AND (envelope IS NOT NULL OR admission IS NOT NULL))
    AND NOT EXISTS(SELECT 1 FROM storage_record_outbox)
    AND NOT EXISTS(SELECT 1 FROM storage_documents WHERE document_id='["ordered-conversion"]')
    AND NOT EXISTS(SELECT 1 FROM storage_record_projections p WHERE NOT EXISTS
      (SELECT 1 FROM storage_ordered_owners o WHERE (o.workbench_id,o.extension_id)=(p.workbench_id,p.extension_id))) AS eligible`)
  ).rows;
  if (!eligible) return false;
  const started=performance.now();const mark=(phase:string)=>console.log("Upgrade diagnostic",phase,Math.round(performance.now()-started));
  const candidate = await beginBatchHome(path);
  let sealed = false;
  try {
    const dest = await openPglite(candidate, options);
    try {
      mark("opened candidate");
      // Both source builds and packaged apps can start with an image already containing today's schema.
      // Recreate the exact released prefix only in the new, private database.
      await dest.exec(
        "DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public AUTHORIZATION pg_database_owner; GRANT USAGE ON SCHEMA public TO PUBLIC",
      );
      await applyPgliteMigrations(dest, journal.slice(0, history.length));
      mark("prefix created");
      await stageLocalTransfers(source, storageRoot);
      await copySmallTables(source, path, dest, candidate, signal);
      mark("copied tables");
      const payload = join(candidate, batchPayload);
      await mkdir(payload, { mode: 0o700 });
      await source.exec(`CREATE TEMP TABLE reimport_owners AS SELECT row_number() OVER (ORDER BY project_id COLLATE "C",extension_id COLLATE "C")::int AS id, project_id,extension_id
        FROM (SELECT workbench_id AS project_id,extension_id FROM storage_ordered_owners UNION SELECT project_id,extension_id FROM pg_temp.local_upgrade_transfers) o; ANALYZE pg_temp.reimport_owners`);
      await copyBinary(
        source,
        path,
        "SELECT id,project_id,extension_id FROM pg_temp.reimport_owners",
        join(payload, "owners.copy"),
      );
      mark("created owners");
      await exportSettledRecords(source, join(payload, recordFile), signal);
      {
        const f = await open(join(payload, "owners.copy"), "r+");
        try {
          await f.sync();
        } finally {
          await f.close();
        }
      }
      await flushDirectory(payload);
      await writeDurably(join(candidate, engineFile), await readFile(join(path, engineFile), "utf8"));
      mark("wrote records");
    } finally {
      await dest.close();
    }
    signal?.throwIfAborted();
    await flushDirectory(candidate);
    await writeDurably(join(batchWork(path), "ready"), "");
    sealed = true;
    await flushDirectory(batchWork(path));
    return true;
  } catch (error) {
    if (error instanceof NeedsRecordAdmission) return false;
    throw error;
  } finally {
    if (!sealed) await recoverBatchHome(path);
  }
}

/** Install the owner IDs used by the sealed COPY files in the transaction that creates the 0.49 schema. */
export async function importBatchOwners(tx: Transaction) {
  await tx.exec(`CREATE TEMP TABLE reimport_owner_ids(id int PRIMARY KEY,project_id text,extension_id text) ON COMMIT DROP;
    COPY reimport_owner_ids FROM '/pglite/data/${batchPayload}/owners.copy' WITH (FORMAT binary);
    INSERT INTO owners(id,project_id,extension_id) OVERRIDING SYSTEM VALUE SELECT id,project_id,extension_id FROM reimport_owner_ids;
    SELECT setval('owners_id_seq',(SELECT max(id) FROM reimport_owner_ids));
    CREATE SCHEMA pstdio_import_048`);
}

/** Install the released index declarations while records is empty, then let COPY update all
 * per-project indexes in one pass. The marker and the data commit together across restarts. */
export async function importBatchRows(db: PGlite) {
  await db.transaction(async (tx) => {
    const {
      rows: [state],
    } = await tx.query<{ pending: boolean }>("SELECT to_regnamespace('pstdio_import_048') IS NOT NULL AS pending");
    if (!state?.pending) return;
    await tx.exec(`
    SET LOCAL maintenance_work_mem='96MB';
    ALTER TABLE records DROP CONSTRAINT records_owner_id_owners_id_fk, DROP CONSTRAINT records_owner_id_record_id_pk;
    DROP INDEX records_native_sources_idx;
    COPY records(owner_id,record_id,deleted,value,query_values,asset,shared,native_sources,native_versions,record_lifetime,revision,meta)
      FROM '/pglite/data/${batchPayload}/${recordFile}' WITH (FORMAT binary);
    ALTER TABLE records ADD CONSTRAINT records_owner_id_record_id_pk PRIMARY KEY(owner_id,record_id),
      ADD CONSTRAINT records_owner_id_owners_id_fk FOREIGN KEY(owner_id) REFERENCES owners(id) ON DELETE CASCADE;
    CREATE INDEX records_native_sources_idx ON records USING gin(native_sources);
    DROP SCHEMA pstdio_import_048`);
  });
}
