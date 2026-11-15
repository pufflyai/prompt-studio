import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vacuumDeadRows } from "./dead-row-cleanup";

// PGlite publishes table statistics once the session has been idle for about a second.
const publishStatistics = async (db: PGlite) => {
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  await db.query("SELECT 1");
};
const deadRows = async (db: PGlite, table: string) =>
  (await db.query<{ dead: number }>("SELECT n_dead_tup AS dead FROM pg_stat_user_tables WHERE relname = $1", [table]))
    .rows[0]?.dead;

describe("dead-row cleanup", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE rewritten (id int PRIMARY KEY, body text);
      CREATE TABLE settled (id int PRIMARY KEY, body text);
      INSERT INTO rewritten SELECT g, 'a' FROM generate_series(1, 500) g;
      INSERT INTO settled SELECT g, 'a' FROM generate_series(1, 500) g;
    `);
    await db.exec("VACUUM");
    await db.exec(`
      UPDATE rewritten SET body = 'b';
      UPDATE settled SET body = 'b' WHERE id <= 10;
    `);
    await publishStatistics(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test("vacuums tables whose dead rows pass the autovacuum threshold and leaves the rest", async () => {
    expect(await vacuumDeadRows(db)).toEqual(["rewritten"]);

    await publishStatistics(db);
    expect(await deadRows(db, "rewritten")).toBe(0);
    expect(await deadRows(db, "settled")).toBe(10);
  });

  test("vacuums a table whose large values were rewritten", async () => {
    await db.exec(`
      CREATE TABLE documents (id int PRIMARY KEY, state text);
      ALTER TABLE documents ALTER COLUMN state SET STORAGE EXTERNAL;
      INSERT INTO documents SELECT g, repeat('x', 8000) FROM generate_series(1, 20) g;
      UPDATE documents SET state = repeat('y', 8000);
    `);
    await publishStatistics(db);

    expect(await vacuumDeadRows(db)).toContain("documents");
  });

  test("judges a reopened database by its estimated rows, not the new session's empty counters", async () => {
    const path = mkdtempSync(join(tmpdir(), "dead-row-cleanup-"));
    try {
      const first = new PGlite(path);
      await first.exec(`
        CREATE TABLE large (id int PRIMARY KEY, body text);
        INSERT INTO large SELECT g, 'a' FROM generate_series(1, 2000) g;
      `);
      await first.exec("VACUUM large");
      await first.close();

      const reopened = new PGlite(path);
      try {
        await reopened.exec("UPDATE large SET body = 'b' WHERE id <= 60");
        await publishStatistics(reopened);
        expect(await vacuumDeadRows(reopened)).toEqual([]);

        await reopened.exec("UPDATE large SET body = 'c' WHERE id <= 500");
        await publishStatistics(reopened);
        expect(await vacuumDeadRows(reopened)).toEqual(["large"]);
      } finally {
        await reopened.close();
      }
    } finally {
      rmSync(path, { recursive: true, force: true });
    }
  });

  test("vacuums nothing once stopped", async () => {
    expect(await vacuumDeadRows(db, { stopped: () => true })).toEqual([]);
    expect(await deadRows(db, "rewritten")).toBe(500);
  });
});
