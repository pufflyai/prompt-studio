import { afterAll, beforeAll, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { projects } from "../schemas.pg";
import { createDbInWorker } from "./open";

let database: Awaited<ReturnType<typeof createDbInWorker>>;
const phases: string[] = [];

beforeAll(async () => {
  database = await createDbInWorker({ path: ":memory:", onPhase: (phase) => phases.push(phase) });
});

afterAll(async () => {
  await database?.close();
});

test("the database opens in its worker and reports each startup phase", () => {
  expect(database.path).toBe(":memory:");
  expect(phases).toContain("database_opened");
  expect(phases).toContain("database_migrated");
});

test("Drizzle queries run against the worker's database", async () => {
  await database.db
    .insert(projects)
    .values({ id: "p-worker", name: "Worker", shorthand: "WRK", created_at: "now", updated_at: "now" });
  const [row] = await database.db.select({ name: projects.name }).from(projects);
  expect(row).toEqual({ name: "Worker" });
});

test("transactions commit, roll back and nest through savepoints", async () => {
  await database.db.execute(sql`CREATE TABLE IF NOT EXISTS worker_tx (id integer primary key)`);
  await database.db.transaction(async (tx) => {
    await tx.execute(sql`INSERT INTO worker_tx VALUES (1)`);
    await tx
      .transaction(async (nested) => {
        await nested.execute(sql`INSERT INTO worker_tx VALUES (2)`);
        throw new Error("undo the nested insert");
      })
      .catch(() => {});
  });
  // Await first: expect(...).rejects does not run the event loop, so a worker reply could never arrive.
  const failed = await database.db
    .transaction(async (tx) => {
      await tx.execute(sql`INSERT INTO worker_tx VALUES (3)`);
      throw new Error("undo the whole transaction");
    })
    .catch((error: Error) => error);
  expect(failed).toBeInstanceOf(Error);
  expect((failed as Error).message).toBe("undo the whole transaction");
  const rows = await database.db.execute(sql`SELECT id FROM worker_tx ORDER BY id`);
  expect(rows.rows).toEqual([{ id: 1 }]);
});

test("database errors keep their PostgreSQL fields across the thread", async () => {
  const error = await database.db.execute(sql`INSERT INTO worker_tx VALUES (1)`).catch((caught) => caught);
  // Drizzle wraps the database error, as it does in-process.
  expect(error.cause).toMatchObject({ code: "23505", constraint: "worker_tx_pkey" });
  expect(String(error.cause.message)).toContain("duplicate key");
});

test("timestamps stay unparsed strings, as Drizzle expects from PGlite", async () => {
  const rows = await database.db.execute(sql`SELECT TIMESTAMP '2026-11-23 10:00:00' AS at`);
  expect(rows.rows).toEqual([{ at: "2026-11-23 10:00:00" }]);
});

test("a long statement in the worker leaves the calling thread responsive", async () => {
  let longestGap = 0;
  let last = performance.now();
  const ticker = setInterval(() => {
    const now = performance.now();
    longestGap = Math.max(longestGap, now - last);
    last = now;
  }, 5);
  try {
    await database.db.execute(
      sql`SELECT count(*) FROM generate_series(1, 3000000) AS a CROSS JOIN generate_series(1, 2) AS b`,
    );
  } finally {
    // Includes the time since the last tick, so a thread blocked until the query returned is caught.
    longestGap = Math.max(longestGap, performance.now() - last);
    clearInterval(ticker);
  }
  expect(longestGap).toBeLessThan(100);
});

test("an on-disk database keeps its lock in the worker and releases it on close", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-worker-"));
  const dbPath = path.join(root, "database");
  fs.mkdirSync(dbPath);
  try {
    const first = await createDbInWorker({ path: dbPath });
    const locked = await createDbInWorker({ path: dbPath }).catch((error: Error) => error);
    expect(locked).toBeInstanceOf(Error);
    await first.close();
    const second = await createDbInWorker({ path: dbPath });
    await second.close();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
