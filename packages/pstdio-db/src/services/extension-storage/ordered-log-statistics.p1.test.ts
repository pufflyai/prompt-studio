import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { storage_log_entries as entries, projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { logWhere } from "./ordered-log-sql";

const owner = { workbenchId: "log-statistics", extensionId: "example.logs" };
const address = { owner, name: "runs", scope: "project", stream: "project", writerId: "laptop" };
const row = (number: number) => ({
  id: `entry-${number}`,
  writerId: "laptop",
  createdAt: "2026-11-04T00:00:00.000Z",
  value: { number },
});
const seedProject = async (db: Awaited<ReturnType<typeof createDb>>["db"]) => {
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: owner.workbenchId, name: "Statistics", shorthand: "S", created_at: now, updated_at: now });
};
const estimatedRows = async (db: Awaited<ReturnType<typeof createDb>>["db"]) => {
  const result = await db.execute<{ rows: number }>(
    sql`SELECT reltuples AS rows FROM pg_class WHERE relname = 'storage_log_entries'`,
  );
  return Number(result.rows[0]!.rows);
};

test("ordinary log receives share planner maintenance across streams and retain it on cold reopen", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "log-statistics-"));
  let connection = await createDb({ path: path.join(directory, "db") });
  try {
    await seedProject(connection.db);
    const first = createDocumentStorageDBService(connection.db);
    const second = createDocumentStorageDBService(connection.db);
    for (const [index, service] of [first, second].entries()) {
      const store = await service.logs.stream(owner, {
        name: "runs",
        writer: "device",
        scope: "project",
        stream: `device-${index}`,
      });
      await store.receive(
        [{ sequence: 1, entries: Array.from({ length: 30 }, (_, number) => row(index * 30 + number)) }],
        1,
      );
    }
    await first.flushStatistics();
    expect(await estimatedRows(connection.db)).toBe(60);
    await connection.close();
    connection = await createDb({ path: path.join(directory, "db") });
    expect(await estimatedRows(connection.db)).toBe(60);
    const reopened = createDocumentStorageDBService(connection.db);
    const store = await reopened.logs.stream(owner, {
      name: "runs",
      writer: "device",
      scope: "project",
      stream: "device-1",
    });
    expect((await store.read({ newest: true, limit: 1 })).entries[0]?.value).toEqual({ number: 59 });
  } finally {
    await connection.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("maintained full-writer point reads, updates and selected-ID hydration seek the primary index", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    await seedProject(connection.db);
    const service = createDocumentStorageDBService(connection.db);
    const store = await service.logs.stream(owner, {
      name: "runs",
      writer: "project",
      scope: "project",
      stream: "project",
    });
    for (let batch = 0; batch < 10; batch++)
      await store.receive(
        [{ sequence: batch + 1, entries: Array.from({ length: 100 }, (_, index) => row(batch * 100 + index)) }],
        batch + 1,
      );
    await service.flushStatistics();
    expect(await estimatedRows(connection.db)).toBeGreaterThan(800);
    const where = and(logWhere(entries, address), eq(entries.entry_id, "entry-999"));
    const selected = [
      "entry-990",
      "entry-991",
      "entry-992",
      "entry-993",
      "entry-994",
      "entry-995",
      "entry-996",
      "entry-997",
      "entry-998",
      "entry-999",
    ];
    const queries = [
      connection.db.select().from(entries).where(where),
      connection.db.update(entries).set({ envelope: null }).where(where),
      connection.db
        .select()
        .from(entries)
        .where(and(logWhere(entries, address), inArray(entries.entry_id, selected))),
    ];
    for (const query of queries) {
      const statement = query.toSQL();
      const result = await connection.pglite.query<{ "QUERY PLAN": { Plan: unknown }[] }>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement.sql}`,
        statement.params,
      );
      const plan = JSON.stringify(result.rows[0]!["QUERY PLAN"][0]!.Plan);
      expect(plan).toContain('"Index Name":"storage_log_entries_pk"');
      expect(plan).not.toContain('"Rows Removed by Filter"');
    }
    expect((await store.lookupMetadata!(selected)).map((entry) => entry.id).sort()).toEqual(selected);
    const other = await service.logs.stream(
      { ...owner, extensionId: "other.logs" },
      { name: "runs", writer: "project", scope: "project", stream: "project" },
    );
    await other.receive([{ sequence: 1, entries: [{ ...row(999), value: "private other owner" }] }], 1);
    expect((await store.read({ newest: true, limit: 1 })).entries[0]?.value).toEqual({ number: 999 });
    expect((await other.read({ newest: true, limit: 1 })).entries[0]?.value).toBe("private other owner");
  } finally {
    await connection.close();
  }
});

test("cached append retries do not count as changed rows for planner maintenance", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    await seedProject(connection.db);
    const service = createDocumentStorageDBService(connection.db);
    const store = await service.logs.stream(owner, {
      name: "runs",
      writer: "project",
      scope: "project",
      stream: "project",
    });
    const first = await store.append("first", { id: "first" });
    for (let attempt = 0; attempt < 60; attempt++) expect(await store.append("first", { id: "first" })).toEqual(first);
    await service.flushStatistics();
    expect(await estimatedRows(connection.db)).toBe(-1);
    for (let index = 0; index < 50; index++) await store.append(index, { id: `new-${index}` });
    await service.flushStatistics();
    expect(await estimatedRows(connection.db)).toBe(51);
  } finally {
    await connection.close();
  }
});
