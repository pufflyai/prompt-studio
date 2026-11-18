import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { storage_record_indexes } from "../../db/schemas.pg";
import { migrateExtensionIdentities } from "../extension-identity-migration";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { installRecordIndex } from "./record-index-lifecycle";

test("reinstalling unchanged indexes after an owner rename restores the current owner's partial indexes", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const service = createDocumentStorageDBService(fixture.db);
    const owner = { workbenchId: fixture.projectAId, extensionId: "pstdio.pstdio-planner" };
    const index: StorageRecordIndex = {
      name: "things",
      prefix: "things/",
      fields: {
        id: { path: ["id"], type: "string" },
        position: { path: ["position"], type: "string" },
      },
      equality: ["position"],
      orderBy: [{ field: "id", direction: "asc" }],
    };
    // Recreate an index installed by a host predating canonical owner names.
    await installRecordIndex(fixture.db, owner, index);
    const [before] = await fixture.db
      .select()
      .from(storage_record_indexes)
      .where(eq(storage_record_indexes.name, index.name));
    await migrateExtensionIdentities(fixture.db, { extensionId: "pstdio.planner" });
    const renamed = service.open({ owner: { ...owner, extensionId: "pstdio.planner" } }).records;
    await renamed.defineIndexes([index]);
    const [after] = await fixture.db
      .select()
      .from(storage_record_indexes)
      .where(eq(storage_record_indexes.name, index.name));
    expect(after.database_name).not.toBe(before.database_name);
    const definition = await fixture.db.execute<{ indexdef: string }>(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname = ${after.database_name}`,
    );
    expect(definition.rows[0].indexdef).toContain("pstdio.planner");
    expect(definition.rows[0].indexdef).not.toContain("pstdio.pstdio-planner");
    await renamed.commit({
      operationId: "seed",
      edits: [{ recordId: "things/a", replace: { id: "a", position: "a" } }],
    });
    expect(
      (
        await renamed.query({
          index: index.name,
          where: { field: "position", op: "eq", value: "a" },
          fields: ["id"],
          limit: 1,
        })
      ).records[0]?.fields.id,
    ).toBe("a");
  } finally {
    await fixture.close();
  }
});
