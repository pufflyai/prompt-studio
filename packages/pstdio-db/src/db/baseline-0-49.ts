import type { PGlite, Transaction } from "@electric-sql/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migratePglite } from "./migrate-pglite";
import { withMigrationsFolder } from "./migration-assets";
import { markCurrentBaseline } from "./pglite-home-recovery";

const releasedFirstHash = "9fa8440e9b062e7c0822a309a0066ded951c8f435ebfa748f40fa1a73b401663";
const history = "drizzle.__drizzle_migrations";

export const hasReleasedJournal = async (db: PGlite) => {
  const { rows } = await db.query<{ present: boolean }>(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present",
  );
  if (!rows[0]?.present) return false;
  const first = await db.query<{ hash: string }>(`SELECT hash FROM ${history} ORDER BY created_at LIMIT 1`);
  return first.rows[0]?.hash === releasedFirstHash;
};

export const verifyReleasedJournal = async (db: PGlite, folder: string) => {
  const journal = readMigrationFiles({ migrationsFolder: folder });
  const { rows } = await db.query<{ hash: string; created_at: string }>(
    `SELECT hash,created_at FROM ${history} ORDER BY created_at`,
  );
  if (
    !rows.length ||
    rows.length > journal.length ||
    !rows.every((r, i) => r.hash === journal[i]!.hash && Number(r.created_at) === journal[i]!.folderMillis)
  )
    throw new Error("Unrecognized released database migration history");
  return { journal, applied: rows.length };
};

export const captureToolUpgradeSources = async (tx: Transaction) => {
  // Capture only sources present at upgrade. Device preferences survive an interrupted tool install.
  await tx.exec(`INSERT INTO preferences(scope,scope_id,extension_id,key,sync,value,updated_at)
        SELECT 'global','global','','upgrade_0_49_first_party_tools','device',jsonb_agg(id ORDER BY id),now()
        FROM extensions WHERE source_kind IN ('git','registry') AND manifest_json ? 'enginesPstdio'
        HAVING count(*)>0 ON CONFLICT DO NOTHING`);
};

/** Adopt the compact journal only after generated DDL and legacy data admission finish. */
export const finishReleasedBaseline = async (db: PGlite, path: string, releasedFolder: string) => {
  const { journal, applied } = await verifyReleasedJournal(db, releasedFolder);
  if (applied !== journal.length) throw new Error("Incomplete released schema");
  const { rows } = await db.query<{ held: boolean }>(
    "SELECT to_regclass('public.storage_ordered_owners') IS NOT NULL OR to_regclass('public.storage_record_sync') IS NOT NULL OR to_regclass('public.storage_record_outbox') IS NOT NULL AS held",
  );
  if (rows[0]!.held) return;
  await withMigrationsFolder(async (folder) => {
    const [baseline] = readMigrationFiles({ migrationsFolder: folder });
    if (!baseline) throw new Error("Missing 0.49 database baseline");
    // On restart the journal remains authoritative until its transaction commits.
    if (path !== ":memory:") await markCurrentBaseline(path);
    await db.transaction(async (tx) => {
      // The released table rename kept its original primary-key name.
      const oldKey = await tx.query(
        "SELECT 1 FROM pg_constraint WHERE conrelid='extensions'::regclass AND conname='installed_extension_sources_pkey'",
      );
      if (oldKey.rows.length)
        await tx.exec("ALTER TABLE extensions RENAME CONSTRAINT installed_extension_sources_pkey TO extensions_pkey");
      await tx.exec(`DELETE FROM ${history}`);
      await tx.query(`INSERT INTO ${history}(hash,created_at) VALUES ($1,$2)`, [baseline.hash, baseline.folderMillis]);
    });
    await migratePglite(db, folder);
  });
};
