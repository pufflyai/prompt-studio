import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePgliteOptions } from "./connection.pglite";
import { migratePglite } from "./migrate-pglite";
import { openPglite } from "./open-pglite";

const migrations = async (source: string[]) => {
  const root = await mkdtemp(join(tmpdir(), "migration-statements-"));
  await mkdir(join(root, "meta"));
  await writeFile(
    join(root, "meta/_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: source.map((_, idx) => ({
        idx,
        version: "7",
        when: idx + 1,
        tag: `migration_${idx}`,
        breakpoints: true,
      })),
    }),
  );
  for (const [index, sql] of source.entries()) await writeFile(join(root, `migration_${index}.sql`), sql);
  return root;
};

test("generated migration statements execute together and reapplying retains exact history", async () => {
  const source =
    "CREATE TABLE migration_probe (id integer PRIMARY KEY, value text NOT NULL);\n--> statement-breakpoint\nINSERT INTO migration_probe VALUES (1,'kept');";
  const folder = await migrations([source]);
  const engine = await openPglite(":memory:", await resolvePgliteOptions());
  await engine.waitReady;
  let executions = 0;
  const query = engine.query.bind(engine),
    exec = engine.exec.bind(engine),
    transaction = engine.transaction.bind(engine);
  engine.transaction = (run) =>
    transaction(async (tx) => {
      const query = tx.query.bind(tx),
        exec = tx.exec.bind(tx);
      tx.query = ((statement, ...args) => {
        if (statement.includes("migration_probe")) executions++;
        return query(statement, ...args);
      }) as typeof tx.query;
      tx.exec = ((statement) => {
        if (statement.includes("migration_probe")) executions++;
        return exec(statement);
      }) as typeof tx.exec;
      return run(tx);
    });
  try {
    await migratePglite(engine, folder);
    expect((await query("SELECT * FROM migration_probe")).rows).toEqual([{ id: 1, value: "kept" }]);
    expect((await query("SELECT hash,created_at::text FROM drizzle.__drizzle_migrations")).rows).toEqual([
      { hash: createHash("sha256").update(source).digest("hex"), created_at: "1" },
    ]);
    expect(executions).toBe(1);
    executions = 0;
    await migratePglite(engine, folder);
    expect(executions).toBe(0);
    expect((await query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows).toEqual([
      { count: 1 },
    ]);
  } finally {
    engine.exec = exec;
    await engine.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("a failing later migration rolls back every pending schema change and history row before retry", async () => {
  const first =
    "CREATE TABLE migration_atomic (id integer PRIMARY KEY);\n--> statement-breakpoint\nINSERT INTO migration_atomic VALUES (1);";
  const failed =
    "INSERT INTO migration_atomic VALUES (2);\n--> statement-breakpoint\nINSERT INTO migration_atomic VALUES (1);";
  const folder = await migrations([first, failed]);
  const engine = await openPglite(":memory:", await resolvePgliteOptions());
  await engine.waitReady;
  try {
    await expect(migratePglite(engine, folder)).rejects.toThrow();
    expect((await engine.query("SELECT to_regclass('migration_atomic') AS table")).rows).toEqual([{ table: null }]);
    expect((await engine.query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows).toEqual([
      { count: 0 },
    ]);
    await writeFile(join(folder, "migration_1.sql"), "INSERT INTO migration_atomic VALUES (2);");
    await migratePglite(engine, folder);
    expect((await engine.query("SELECT id FROM migration_atomic ORDER BY id")).rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect((await engine.query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows).toEqual([
      { count: 2 },
    ]);
  } finally {
    await engine.close();
    await rm(folder, { recursive: true, force: true });
  }
});
