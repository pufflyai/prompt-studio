import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { runScenario, scenarioById } from "pstdio-benchmarks/writer";
import { compareRows, createRow, scaleScopePredicate, scaleViewFields } from "storage-scale-fixture";
import { createDb } from "../../db/connection.pglite";
import { databaseFixtureOwner, prepareDatabaseFixture } from "./database-scale-fixture";
import { createDocumentStorageDBService } from "./document-storage";

// Fixture creation happens in another process. The measured process's first storage read is cold.
const workload = scenarioById("B7");
assert(workload.id === "B7");
const fixture = workload.fixture;
if (process.argv[2] === "--seed") {
  assert(process.argv[3]);
  await prepareDatabaseFixture(fixture.kind, fixture.records, process.argv[3], false, (event) =>
    console.log(JSON.stringify(event)),
  );
} else
  await runScenario("B7", async (capture) => {
    const root = await mkdtemp(join(tmpdir(), "critical-store-"));
    try {
      const seed = Bun.spawn([process.execPath, import.meta.path, "--seed", root], {
        stdout: "inherit",
        stderr: "inherit",
      });
      try {
        assert.equal(await seed.exited, 0, "Fixed record fixture preparation failed");
      } finally {
        seed.kill();
        await seed.exited;
      }
      capture.detail("fixture", {
        ...fixture,
        caveat: "Fresh storage process; fixture writes can remain in the OS file cache",
      });
      const { db, close } = await createDb({ path: join(root, "database") });
      const service = createDocumentStorageDBService(db);
      try {
        const records = service.open({ owner: databaseFixtureOwner }).records;
        const expected = Array.from({ length: fixture.records }, (_, index) =>
          createRow(fixture.kind, 0, index, fixture.historyEdits),
        )
          .sort(compareRows)
          .slice(0, fixture.pageSize)
          .map((row) => row.id);
        const counters = async () => {
          await db.execute(sql`select pg_stat_force_next_flush()`);
          const table = await db.execute<{ seq_rows: string; writes: string }>(sql`
          select seq_tup_read as seq_rows, n_tup_ins+n_tup_upd+n_tup_del as writes
          from pg_stat_user_tables where relname='storage_current_records'`);
          const index = await db.execute<{ rows: string }>(sql`
          select coalesce(sum(idx_tup_read),0) as rows from pg_stat_user_indexes where relname='storage_current_records'`);
          assert.equal(table.rows.length, 1);
          return {
            sequential: Number(table.rows[0]!.seq_rows),
            indexed: Number(index.rows[0]!.rows),
            writes: Number(table.rows[0]!.writes),
          };
        };
        let returned = 0,
          transferred = 0,
          scanned = 0;
        const page = async (metric: string, indexed: boolean, submitted?: Awaited<ReturnType<typeof counters>>) => {
          const before = submitted ?? (await counters());
          const started = performance.now();
          const result = await records.query({
            index: "scale-rows",
            where: scaleScopePredicate(),
            fields: scaleViewFields,
            limit: fixture.pageSize,
          });
          const elapsed = performance.now() - started;
          const after = await counters();
          capture.detail(metric, { before, after, elapsedMs: elapsed, result });
          capture.record(metric, elapsed);
          assert.deepEqual(
            result.records.map((record) => record.fields.id),
            expected,
          );
          assert.equal(result.records.length, fixture.pageSize);
          if (indexed) {
            assert.equal(after.sequential - before.sequential, 0, "A bounded indexed page scanned the full projection");
            assert(after.indexed > before.indexed, "The index traversal counter did not advance");
          }
          returned += result.records.length;
          transferred += Buffer.byteLength(JSON.stringify(result));
          scanned += after.sequential - before.sequential + after.indexed - before.indexed;
        };
        await page("cold-read", true);
        await page("warm-read", true);
        const row = createRow(fixture.kind, 0, 0, fixture.historyEdits);
        const changed = { ...row, title: "Critical store edit" };
        const beforeWrites = await counters();
        const started = performance.now();
        await records.commit({ operationId: "critical-edit", edits: [{ recordId: row.id, replace: changed }] });
        const editedAt = performance.now();
        assert.deepEqual((await records.readMany([row.id]))[0]!.value, changed);
        capture.record("edit", editedAt - started);
        const maintenanceRows = Array.from({ length: fixture.maintenanceRecords }, (_, index) => ({
          ...createRow(fixture.kind, 0, index + 1, fixture.historyEdits),
          title: `Maintenance ${index}`,
        }));
        const contentionCounters = await counters();
        let maintenanceDone = false;
        const maintenance = (async () => {
          await records.commit({
            operationId: "critical-maintenance",
            edits: maintenanceRows.map((value) => ({ recordId: value.id, replace: value })),
          });
          // Exercise the current PostgreSQL projection's real maintenance path, not retired legacy folding.
          await db.execute(sql`vacuum (analyze) storage_current_records`);
          maintenanceDone = true;
        })();
        void maintenance.catch(() => {});
        assert.equal(maintenanceDone, false);
        try {
          await page("contended-read", false, contentionCounters);
        } finally {
          await maintenance;
        }
        const actual = await records.readMany(maintenanceRows.map((value) => value.id));
        assert.deepEqual(
          actual.map((value) => value.value),
          maintenanceRows,
        );
        await service.flushStatistics();
        const afterWrites = await counters();
        capture.detail("maintenance", {
          writes: afterWrites.writes - beforeWrites.writes,
          submittedRecords: 1 + fixture.maintenanceRecords,
        });
        assert.equal(
          afterWrites.writes - beforeWrites.writes,
          1 + fixture.maintenanceRecords,
          "Unexpected projection write amplification",
        );
        capture.record("rows-scanned", scanned);
        capture.record("rows-returned", returned);
        capture.record("writes", afterWrites.writes - beforeWrites.writes);
        capture.record("transferred", transferred);
        capture.record("rss-peak", process.resourceUsage().maxRSS * 1_024);
      } finally {
        await close();
      }
    } finally {
      await rm(root, { recursive: true });
    }
  });
