import { open, readFile, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { preferences } from "./schemas/preferences";

interface GlobalPreferencesSnapshot {
  settings?: {
    notifications_enabled: boolean;
    machine_tokens_enabled: boolean;
    max_concurrent_sessions: number | null;
    created_at: string;
    updated_at: string;
  };
  environmentId?: string;
}

// The migration can remove the old tables. Keep the small conversion input in a durable
// file until the new rows commit, so a crash after schema migration cannot lose settings.
export const prepareAppPreferencesUpgrade = async (db: DbClient, path: string) => {
  const snapshotPath = path === ":memory:" ? undefined : `${path}-app-preferences-upgrade.json`;
  let snapshot: GlobalPreferencesSnapshot | undefined;
  if (snapshotPath) {
    try {
      snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (!snapshot) {
    const {
      rows: [tables],
    } = await db.execute<{ current: string | null; settings: string | null; environment: string | null }>(sql`
      SELECT to_regclass('public.preferences')::text AS current,
        to_regclass('public.settings')::text AS settings,
        to_regclass('public.local_environment')::text AS environment
    `);
    if (tables.current || (!tables.settings && !tables.environment)) return;
    snapshot = {};
    if (tables.settings) {
      const { rows } = await db.execute<NonNullable<GlobalPreferencesSnapshot["settings"]>>(sql`
        SELECT notifications_enabled, machine_tokens_enabled, max_concurrent_sessions, created_at, updated_at
        FROM settings WHERE id = 'global'
      `);
      snapshot.settings = rows[0];
    }
    if (tables.environment) {
      const { rows } = await db.execute<{ environment_id: string }>(sql`
        SELECT environment_id FROM local_environment WHERE id = 'local'
      `);
      snapshot.environmentId = rows[0]?.environment_id;
    }
    if (snapshotPath) {
      const temporary = `${snapshotPath}.tmp`;
      const file = await open(temporary, "w", 0o600);
      try {
        await file.writeFile(JSON.stringify(snapshot));
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, snapshotPath);
      await flushDirectory(dirname(snapshotPath));
    }
  }
  const captured = snapshot;
  return async () => {
    const owner = { scope: "global", scope_id: "global", extension_id: "", sync: "device" } as const;
    const rows: (typeof preferences.$inferInsert)[] = [];
    if (captured.settings) {
      const { created_at, updated_at, ...values } = captured.settings;
      for (const [key, value] of Object.entries(values)) rows.push({ ...owner, key, value, updated_at });
      rows.push({ ...owner, key: "settings_created_at", value: created_at, updated_at: created_at });
    }
    if (captured.environmentId)
      rows.push({
        ...owner,
        key: "environment_id",
        value: captured.environmentId,
        updated_at: new Date().toISOString(),
      });
    if (rows.length)
      await db.transaction(async (tx) => {
        await tx.insert(preferences).values(rows).onConflictDoNothing();
      });
    if (snapshotPath) {
      await rm(snapshotPath);
      await flushDirectory(dirname(snapshotPath));
    }
  };
};
