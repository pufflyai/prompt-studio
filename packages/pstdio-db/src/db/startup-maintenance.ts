import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";

// This retired host-owned format stored transcripts in CRDT documents. Current device logs
// and local conversation files have separate owners and must survive this cleanup.
const legacyOwnerPrefix = '["pstdio.personal-history",';

export type DatabaseMaintenancePhase = "database_cleaning" | "database_compacting";

export const maintainDatabase = async (
  db: PGlite,
  path: string,
  fresh: boolean,
  onPhase: (phase: DatabaseMaintenancePhase) => void,
) => {
  if (path === ":memory:") return;
  const marker = join(path, ".pstdio-maintenance.json");
  const { rows } = await db.query<{ migration: string; legacy: boolean }>(
    `SELECT
      (SELECT hash || ':' || created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1) AS migration,
      EXISTS (SELECT 1 FROM storage_documents WHERE starts_with(extension_id, $1)) AS legacy`,
    [legacyOwnerPrefix],
  );
  const expected = JSON.stringify({ version: 1, migration: rows[0].migration });
  const previous = await readFile(marker, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (previous === expected && !rows[0].legacy) return;

  // Invalidate completion before deleting anything. A crash after deletion or migration
  // must still vacuum on the next start, even when no obsolete documents remain.
  await rm(marker, { force: true });
  if (rows[0].legacy) {
    onPhase("database_cleaning");
    await db.query("DELETE FROM storage_documents WHERE starts_with(extension_id, $1)", [legacyOwnerPrefix]);
  }

  // The migrator has committed and the runtime still owns the exclusive database lock.
  // FULL returns unused table/index/TOAST space to disk; a fresh image has none to reclaim.
  if (!fresh || rows[0].legacy) {
    onPhase("database_compacting");
    await db.exec("VACUUM (FULL, ANALYZE)");
  }
  const temporary = `${marker}.tmp`;
  try {
    await writeFile(temporary, expected);
    await rename(temporary, marker);
  } finally {
    await rm(temporary, { force: true });
  }
};
