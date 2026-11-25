import { afterAll, beforeAll, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { withRuntimeOperationOrigin } from "pstdio-diagnostics";
import { projects } from "../schemas.pg";
import { createDbInWorker, waitForDatabaseWorkersIdle } from "./open";

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

test.each([
  "query",
  "exec",
  "transaction",
] as const)("a core read gets a turn during an extension %s burst", async (method) => {
  const { pglite } = database;
  await pglite.exec("CREATE TEMP TABLE IF NOT EXISTS worker_admission (id integer); TRUNCATE worker_admission");
  const statement = "INSERT INTO worker_admission VALUES (1)";
  const write = () => {
    if (method === "query") return pglite.query(statement);
    if (method === "exec") return pglite.exec(statement);
    return pglite.transaction((tx) => tx.query(statement));
  };

  // Keep the engine occupied until the worker has received both writes and the core read.
  const { burst, read } = await pglite.transaction(async () => {
    const burst = withRuntimeOperationOrigin({ kind: "command", name: "bulk.save", extensionId: "ext.bulk" }, () =>
      Promise.all([write(), write()]),
    );
    const read = pglite.query<{ writes: number }>("SELECT count(*)::int AS writes FROM worker_admission");
    return { burst, read };
  });

  const [result] = await Promise.all([read, burst]);
  expect(result.rows[0]!.writes).toBeLessThan(2);
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

test("retired-row cleanup runs in the worker and stops when the caller says so", async () => {
  await database.cleanupRetiredRows(() => false);
  await database.cleanupRetiredRows(() => true);
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

test("an error at commit time rejects the transaction, as in-process", async () => {
  await database.db.execute(sql`CREATE TABLE IF NOT EXISTS worker_parent (id integer primary key)`);
  await database.db.execute(
    sql`CREATE TABLE IF NOT EXISTS worker_child (parent integer REFERENCES worker_parent (id) DEFERRABLE INITIALLY DEFERRED)`,
  );
  const failed = await database.db
    .transaction(async (tx) => {
      await tx.execute(sql`INSERT INTO worker_child VALUES (42)`);
    })
    .catch((error: Error) => error);
  expect(failed).toMatchObject({ code: "23503" });
  expect((await database.db.execute(sql`SELECT count(*)::int AS n FROM worker_child`)).rows).toEqual([{ n: 0 }]);
});

test("a parameter that cannot cross the thread fails its call and leaves nothing pending", async () => {
  const failed = await database.pglite.query("SELECT $1::text AS x", [{ run: () => 1 }]).catch((error: Error) => error);
  expect(failed).toBeInstanceOf(Error);
  await waitForDatabaseWorkersIdle(1_000);
  expect((await database.pglite.query<{ x: number }>("SELECT 1 AS x")).rows).toEqual([{ x: 1 }]);
});

test("a worker that stops unexpectedly is reported once and later calls fail at once", async () => {
  let worker: Worker | undefined;
  const reported: Error[] = [];
  const crashing = await createDbInWorker({
    path: ":memory:",
    onUnexpectedExit: (error) => reported.push(error),
    createWorker: (specifier) => {
      worker = new Worker(specifier);
      return worker;
    },
  });
  worker!.terminate();
  for (let attempt = 0; reported.length === 0 && attempt < 100; attempt++) await Bun.sleep(10);
  expect(reported).toHaveLength(1);
  const later = await crashing.pglite.query("SELECT 1").catch((error: Error) => error);
  expect(String(later)).toContain("database worker stopped");
  await crashing.close();
  expect(reported).toHaveLength(1);
});

test("closing twice is harmless and a call after close fails instead of hanging", async () => {
  const closing = await createDbInWorker({ path: ":memory:" });
  await Promise.all([closing.close(), closing.close()]);
  const after = await closing.pglite.query("SELECT 1").catch((error: Error) => error);
  expect(after).toBeInstanceOf(Error);
});

test("a fatal exit can wait for a statement already running in the worker", async () => {
  let finished = false;
  const running = database.db
    .execute(sql`SELECT count(*) FROM generate_series(1, 3000000) AS a CROSS JOIN generate_series(1, 2) AS b`)
    .then(() => {
      finished = true;
    });
  await waitForDatabaseWorkersIdle(10_000);
  expect(finished).toBe(true);
  await running;
});

test("a fatal exit waits for a database that is still running its startup statements", async () => {
  let opened = false;
  const opening = createDbInWorker({ path: ":memory:" }).then((startup) => {
    opened = true;
    return startup;
  });
  await waitForDatabaseWorkersIdle(30_000);
  expect(opened).toBe(true);
  await (await opening).close();
});

const startupResult = (opening: ReturnType<typeof createDbInWorker>) =>
  opening.then(
    async (db) => {
      await db.close();
      return "opened";
    },
    (error: unknown) => error,
  );

test("a failed startup phase callback rejects opening and releases the disk lock", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-worker-phase-"));
  const dbPath = path.join(root, "database");
  fs.mkdirSync(dbPath);
  const failure = new Error("Could not publish the runtime descriptor");
  try {
    const result = await startupResult(
      createDbInWorker({
        path: dbPath,
        onPhase: (phase) => {
          if (phase === "database_locked") throw failure;
        },
      }),
    );
    expect(result).toBe(failure);
    await (await createDbInWorker({ path: dbPath })).close();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

test("aborting an in-memory open from a startup phase rejects with the caller's reason", async () => {
  const controller = new AbortController();
  const reason = new Error("Startup cancelled");
  const result = await startupResult(
    createDbInWorker({
      path: ":memory:",
      signal: controller.signal,
      onPhase: (phase) => {
        if (phase === "database_engine_loaded") controller.abort(reason);
      },
    }),
  );
  expect(result).toBe(reason);
});

test("aborting the final startup phase closes the opened database before rejecting", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-worker-abort-"));
  const dbPath = path.join(root, "database");
  fs.mkdirSync(dbPath);
  const controller = new AbortController();
  const reason = new Error("Startup finished after cancellation");
  try {
    const result = await startupResult(
      createDbInWorker({
        path: dbPath,
        signal: controller.signal,
        onPhase: (phase) => {
          if (phase === "database_migrated") controller.abort(reason);
        },
      }),
    );
    expect(result).toBe(reason);
    await (await createDbInWorker({ path: dbPath })).close();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
