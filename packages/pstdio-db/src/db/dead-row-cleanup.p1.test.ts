import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vacuumDeadRows } from "./dead-row-cleanup";

// PGlite otherwise publishes table statistics only after the session has been idle for a second.
const publishStatistics = async (db: PGlite) => {
  await db.query("SELECT pg_stat_force_next_flush()");
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

  test("vacuums nothing once stopped", async () => {
    expect(await vacuumDeadRows(db, { stopped: () => true })).toEqual([]);
    expect(await deadRows(db, "rewritten")).toBe(500);
  });
});

describe("dead-row cleanup across restarts", () => {
  let path: string;

  beforeEach(async () => {
    path = mkdtempSync(join(tmpdir(), "dead-row-cleanup-"));
    const first = new PGlite(path);
    await first.exec(`
      CREATE TABLE large (id int PRIMARY KEY, body text);
      INSERT INTO large SELECT g, 'a' FROM generate_series(1, 2000) g;
    `);
    await first.exec("VACUUM large");
    // 300 rewritten rows stay below this session's threshold of 50 + 20% of 2,000 rows.
    await first.exec("UPDATE large SET body = 'b' WHERE id <= 300");
    await first.close();
  });

  afterEach(() => {
    rmSync(path, { recursive: true, force: true });
  });

  test("judges a reopened database by its estimated rows, not the new session's empty counters", async () => {
    const reopened = new PGlite(path);
    try {
      await reopened.exec("UPDATE large SET body = 'c' WHERE id <= 60");
      await publishStatistics(reopened);
      expect(await vacuumDeadRows(reopened)).toEqual([]);

      await reopened.exec("UPDATE large SET body = 'd' WHERE id <= 500");
      await publishStatistics(reopened);
      expect(await vacuumDeadRows(reopened)).toEqual(["large"]);
    } finally {
      await reopened.close();
    }
  });

  test("reclaims dead rows that an earlier session left below its threshold", async () => {
    const reopened = new PGlite(path);
    try {
      const size = async () =>
        Number((await reopened.query<{ bytes: number }>("SELECT pg_relation_size('large') AS bytes")).rows[0]!.bytes);
      // The new session's counters start empty, so the earlier session's dead rows are invisible to the rule.
      expect(await vacuumDeadRows(reopened)).toEqual([]);

      expect(await vacuumDeadRows(reopened, { all: true })).toEqual(["large"]);
      const reclaimed = await size();
      await reopened.exec("UPDATE large SET body = 'e' WHERE id <= 300");
      // Rewrites after the full pass reuse the reclaimed space instead of growing the table.
      expect(await size()).toBe(reclaimed);
    } finally {
      await reopened.close();
    }
  });
});
