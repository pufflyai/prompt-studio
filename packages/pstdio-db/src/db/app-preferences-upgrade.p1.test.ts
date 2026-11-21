import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createEnvironmentDBService } from "../services/environment/environment";
import { createSettingsDBService } from "../services/settings/settings";
import { createDb } from "./connection.pglite";

test("upgrading preserves device identity and global settings without replaying old values on reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "app-preferences-upgrade-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createDb({ path });
    const stamp = "2026-11-20T00:00:00.000Z";
    await connection.pglite.exec(`
      CREATE TABLE settings (
        id text PRIMARY KEY, notifications_enabled boolean NOT NULL,
        machine_tokens_enabled boolean NOT NULL, max_concurrent_sessions integer,
        created_at text NOT NULL, updated_at text NOT NULL
      );
      CREATE TABLE local_environment (id text PRIMARY KEY, environment_id text NOT NULL);
    `);
    await connection.pglite.query("INSERT INTO settings VALUES ('global', true, true, 3, $1, $1)", [stamp]);
    await connection.pglite.query("INSERT INTO local_environment VALUES ('local', 'retained-device')");
    // Recreate the released schema boundary; the source values remain in their old tables.
    await connection.db.execute(sql`DROP TABLE preferences`);
    const migrations = await connection.pglite.query<{ id: number }>(
      "SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
    );
    await connection.pglite.query("DELETE FROM drizzle.__drizzle_migrations WHERE id = $1", [migrations.rows[0].id]);
    await connection.close();
    connection = await createDb({ path });
    const store = createSettingsDBService(connection.db);
    expect(await store.get()).toMatchObject({
      id: "global",
      created_at: stamp,
      updated_at: stamp,
      notifications_enabled: true,
      machine_tokens_enabled: true,
      max_concurrent_sessions: 3,
    });
    expect(await createEnvironmentDBService(connection.db).get()).toEqual({ environmentId: "retained-device" });
    await store.update({ notifications_enabled: false, max_concurrent_sessions: 5 });
    await connection.close();
    connection = await createDb({ path });
    expect(await createSettingsDBService(connection.db).get()).toMatchObject({
      id: "global",
      created_at: stamp,
      notifications_enabled: false,
      machine_tokens_enabled: true,
      max_concurrent_sessions: 5,
    });
    expect(await createEnvironmentDBService(connection.db).get()).toEqual({ environmentId: "retained-device" });
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
    await rm(`${path}-index-nodes`, { recursive: true, force: true });
  }
});
