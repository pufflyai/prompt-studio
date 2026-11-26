import type { PGlite, Transaction } from "@electric-sql/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { retireLegacyRecordTables } from "./legacy-record-retirement";
import { hasUpgradeSnapshots } from "./upgrade-snapshot";

/** Generated DDL and owner admission finish separately. A held conversion
 * may need to resume even after the complete migration history is present. */
const currentPgliteSchemaState = async (db: PGlite, migrationsFolder: string) => {
  const {
    rows: [state],
  } = await db.query<{ history: string | null; legacy: boolean }>(`
    SELECT to_regclass('drizzle.__drizzle_migrations')::text AS history,
      to_regclass('public.storage_record_sync') IS NOT NULL
      OR to_regclass('public.storage_record_outbox') IS NOT NULL
      OR to_regclass('public.storage_ordered_owners') IS NOT NULL AS legacy`);
  if (!state?.history) return "upgrade";
  const migrations = readMigrationFiles({ migrationsFolder });
  const { rows } = await db.query<{ hash: string; created_at: string | number }>(
    'SELECT hash,created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at',
  );
  if (
    rows.length !== migrations.length ||
    !rows.every(
      (row, index) =>
        row.hash === migrations[index]!.hash && Number(row.created_at) === migrations[index]!.folderMillis,
    )
  )
    return "upgrade";
  if (state.legacy) return "admission";
  // Number-only owners can still need admission after stream-table retirement.
  const {
    rows: [pending],
  } = await db.query<{ present: boolean }>(`
    SELECT EXISTS (SELECT 1 FROM owners o WHERE o.extension_id='pstdio'
      AND EXISTS (SELECT 1 FROM documents d WHERE d.owner_id=o.id
        AND d.key='resource-identities')) AS present`);
  return pending!.present ? "admission" : "current";
};

export const resumeCurrentPgliteSchema = async (input: {
  engine: PGlite;
  migrationsFolder: string;
  path: string;
  fresh: boolean;
  finishLegacyAdmission: () => Promise<void>;
}) => {
  const { engine, migrationsFolder, path, fresh, finishLegacyAdmission } = input;
  // Durable conversion inputs always resume, including beside a fresh image.
  if (await hasUpgradeSnapshots(path)) return false;
  if (fresh) {
    await migratePglite(engine, migrationsFolder);
    await retireLegacyRecordTables(engine, migrationsFolder);
    return true;
  }
  const state = await currentPgliteSchemaState(engine, migrationsFolder);
  if (state === "admission") await finishLegacyAdmission();
  return state !== "upgrade";
};

/** Keep Drizzle's generated SQL, hashes, ordering and all-pending transaction.
 * PGlite can execute each migration in one simple-protocol batch instead of
 * crossing the JavaScript/WASM boundary for every generated statement. */
export const migratePglite = (
  db: PGlite,
  migrationsFolder: string,
  layoutImport?: (tx: Transaction) => Promise<void>,
) => applyPgliteMigrations(db, readMigrationFiles({ migrationsFolder }), layoutImport);

export const applyPgliteMigrations = async (
  db: PGlite,
  migrations: ReturnType<typeof readMigrationFiles>,
  layoutImport?: (tx: Transaction) => Promise<void>,
) => {
  await db.exec('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await db.exec(`CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
  )`);
  const { rows } = await db.query<{ created_at: number | string }>(
    'SELECT created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at DESC LIMIT 1',
  );
  const previous = rows[0];
  await db.transaction(async (tx) => {
    for (const migration of migrations) {
      if (previous && Number(previous.created_at) >= migration.folderMillis) continue;
      await tx.exec(migration.sql.join("\n"));
      // Install released owner IDs when 0011 creates the identity column.
      if (migration.folderMillis === 1795380506774) await layoutImport?.(tx);
      await tx.query('INSERT INTO "drizzle"."__drizzle_migrations" (hash,created_at) VALUES ($1,$2)', [
        migration.hash,
        migration.folderMillis,
      ]);
    }
  });
};
