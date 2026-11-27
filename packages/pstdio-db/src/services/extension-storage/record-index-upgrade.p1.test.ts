import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { resourceActivityOwnerId } from "pstdio-api-contracts";
import { fingerprint, type Json, type StorageRecordIndex } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { createExtensionIndexCleanup } from "../../db/retire-extension-indexes";
import { createProjectsDBService } from "../projects/projects";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { defineRecordIndexes } from "./record-index-definition";
import { saveRecordIndexRow, recordIndexRows as storage_record_indexes } from "./record-index-rows";
import { storageOwnerKey } from "./storage-owner-key";

// A saved home keeps its public definitions across physical query-layout upgrades.
test.each([
  false,
  true,
])("retires persisted v2 indexes and preserves records (deferCleanup=%s)", async (deferCleanup) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-record-index-upgrade-"));
  const path = join(root, "database");
  let handle: Pick<Awaited<ReturnType<typeof createDb>>, "db" | "close"> | undefined;
  try {
    const first = await createExtensionStorageFixture(path);
    handle = first;
    const owner = { workbenchId: first.projectAId, extensionId: "ext.example" };
    const index: StorageRecordIndex = {
      name: "tickets",
      prefix: "ticket/",
      fields: { status: { path: ["status"], type: "string" }, rank: { path: ["rank"], type: "number" } },
      equality: ["status"],
      orderBy: [{ field: "rank", direction: "asc" }],
    };
    const open = () => createDocumentStorageDBService(handle!.db).open({ owner }).records;
    await defineRecordIndexes(handle.db, owner, [index], "host-index");
    await open().commit({
      operationId: "seed-upgrade",
      edits: Array.from({ length: 12 }, (_, rank) => ({
        recordId: `ticket/${rank}`,
        replace: { status: rank % 2 ? "open" : "closed", rank },
      })),
    });
    const saved = await open().read("ticket/3");
    const address = and(eq(storage_record_indexes.owner_id, storageOwnerKey(owner)));
    const [current] = await handle.db.select().from(storage_record_indexes).where(address);
    const legacyName = `storage_query_${(await fingerprint({ owner, definition: index as unknown as Json, layout: 2 })).slice(0, 32)}`;
    // Reproduce v2's persisted physical names without changing public declarations or record data.
    for (const suffix of ["", "_o"])
      await handle.db.execute(
        sql`ALTER INDEX ${sql.identifier(current.database_name + suffix)} RENAME TO ${sql.identifier(legacyName + suffix)}`,
      );
    await handle.db.execute(
      sql`ALTER STATISTICS ${sql.identifier(`${current.database_name}_s0`)} RENAME TO ${sql.identifier(`${legacyName}_s0`)}`,
    );
    await saveRecordIndexRow(handle.db, { ...current, database_name: legacyName });
    const legacyPage = await open().query({ index: index.name, limit: 3 });
    expect(legacyPage.cursor).not.toBeNull();
    await handle.close();
    handle = undefined;
    const reopened = await createDb({ path, deferCleanup });
    handle = reopened;
    if (deferCleanup) {
      await open().defineIndexes([index]);
      await reopened.cleanupRetiredRows(() => true);
      expect((await handle.db.execute(sql`SELECT to_regclass(${legacyName}) IS NOT NULL AS present`)).rows).toEqual([
        { present: true },
      ]);
      expect((await open().query({ index: index.name, cursor: legacyPage.cursor!, limit: 3 })).records).toHaveLength(3);
      await reopened.cleanupRetiredRows(() => false);
    }
    expect((await handle.db.execute(sql`SELECT to_regclass(${legacyName})::text AS name`)).rows).toEqual([
      { name: null },
    ]);
    expect(await open().read("ticket/3")).toEqual(saved);
    await expect(open().query({ index: index.name, cursor: legacyPage.cursor! })).rejects.toThrow("stale");
    const page = await open().query({ index: index.name, limit: 3 });
    expect(page.records.map(({ fields }) => fields.rank)).toEqual([0, 1, 2]);
    expect(
      (await open().query({ index: index.name, cursor: page.cursor!, limit: 3 })).records.map(
        ({ fields }) => fields.rank,
      ),
    ).toEqual([3, 4, 5]);
    const physical = async () => {
      const result = await handle!.db.execute<{ name: string }>(sql`
        SELECT indexname AS name FROM pg_indexes WHERE starts_with(indexname, 'storage_query_')
        UNION ALL SELECT stxname AS name FROM pg_statistic_ext WHERE starts_with(stxname, 'storage_query_') ORDER BY name`);
      return result.rows.map(({ name }) => name);
    };
    const names = await physical();
    expect(names).toEqual([]);
    await open().defineIndexes([index]);
    expect(await physical()).toEqual(names);
    expect((await open().query({ index: index.name, limit: 3 })).revision).toBe(page.revision);
    await handle.close();
    handle = undefined;
    handle = await createDb({ path });
    await open().defineIndexes([index]);
    expect(await physical()).toEqual(names);
    expect(await open().read("ticket/3")).toEqual(saved);
    expect((await open().query({ index: index.name, limit: 3 })).revision).toBe(page.revision);
    await createProjectsDBService(handle.db).hardDelete(owner.workbenchId);
    expect(await physical()).toEqual([]);
  } finally {
    await handle?.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

test("quiet cleanup and host registration preserve existing core Activity indexes", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: fixture.projectAId, extensionId: resourceActivityOwnerId };
    const index: StorageRecordIndex = {
      name: "activity",
      fields: { scope: { path: ["scope"], type: "string" } },
      equality: ["scope"],
    };
    const register = () => defineRecordIndexes(fixture.db, owner, [index], "host-index");
    const physical = async () =>
      (
        await fixture.db.execute(sql`
      SELECT oid, relname FROM pg_class WHERE relkind = 'i' AND starts_with(relname, 'storage_query_') ORDER BY oid
    `)
      ).rows;
    await register();
    const before = await physical();
    expect(before.length).toBeGreaterThan(0);
    await createExtensionIndexCleanup(fixture.db)(() => false);
    await register();
    expect(await physical()).toEqual(before);
  } finally {
    await fixture.close();
  }
});
