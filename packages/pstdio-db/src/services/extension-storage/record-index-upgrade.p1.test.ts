import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { fingerprint, type Json, type StorageRecordIndex } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { storage_record_indexes } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

// A saved home keeps its public definitions across physical query-layout upgrades.
test("upgrades persisted v2 indexes, rejects old cursors and preserves records across reopening", async () => {
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
    await open().defineIndexes([index]);
    await open().commit({
      operationId: "seed-upgrade",
      edits: Array.from({ length: 12 }, (_, rank) => ({
        recordId: `ticket/${rank}`,
        replace: { status: rank % 2 ? "open" : "closed", rank },
      })),
    });
    const saved = await open().read("ticket/3");
    const address = and(
      eq(storage_record_indexes.workbench_id, owner.workbenchId),
      eq(storage_record_indexes.extension_id, owner.extensionId),
    );
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
    await handle.db.update(storage_record_indexes).set({ database_name: legacyName }).where(address);
    const legacyPage = await open().query({ index: index.name, limit: 3 });
    expect(legacyPage.cursor).not.toBeNull();
    await handle.close();
    handle = undefined;
    handle = await createDb({ path });
    await open().defineIndexes([index]);
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
    expect(names).toHaveLength(3);
    expect(names.every((name) => name.startsWith("storage_query_v3_"))).toBe(true);
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
