import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { owners as recordOwners, records } from "../../db/schemas.pg";
import { migrateExtensionIdentities } from "../extension-identity-migration";
import { seedDocumentHistory } from "./document-history.fixture";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { defineRecordIndexes } from "./record-index-definition";
import { installRecordIndex } from "./record-index-lifecycle";
import { recordIndexRows as storage_record_indexes } from "./record-index-rows";
import { ensureStorageOwner } from "./storage-owner-key";

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
    await defineRecordIndexes(fixture.db, { ...owner, extensionId: "pstdio.planner" }, [index], "host-index");
    const [after] = await fixture.db
      .select()
      .from(storage_record_indexes)
      .where(eq(storage_record_indexes.name, index.name));
    expect(after.database_name).not.toBe(before.database_name);
    const definition = await fixture.db.execute<{ indexdef: string }>(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname = ${after.database_name}`,
    );
    expect(definition.rows[0].indexdef).toContain(`owner_id = ${after.owner_id}`);
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

test("renamed owners keep their group counts before and after reinstalling indexes", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: fixture.projectAId, extensionId: "pstdio.pstdio-planner" };
    const legacy = { owner_id: await ensureStorageOwner(fixture.db, owner) };
    const index: StorageRecordIndex = {
      name: "things",
      fields: { state: { type: "string", path: ["state"], derive: { kind: "string" } } },
      countBy: ["state"],
    };
    await seedDocumentHistory(fixture.db, { ...legacy, document_id: "records", state: new Uint8Array() });
    await fixture.db
      .update(recordOwners)
      .set({ revision: 1, live_count: 1 })
      .where(eq(recordOwners.id, legacy.owner_id));
    await fixture.db.insert(records).values({
      ...legacy,
      record_id: "one",
      deleted: false,
      revision: "first",
      value: { state: "open" },
      query_values: { things: { state: "open" } },
    });
    await installRecordIndex(fixture.db, owner, index);
    await migrateExtensionIdentities(fixture.db, { extensionId: "pstdio.planner" });

    const storage = createDocumentStorageDBService(fixture.db);
    const renamed = storage.open({ owner: { ...owner, extensionId: "pstdio.planner" } }).records;
    const query = { index: index.name, groupBy: "state" };
    const reference = await renamed.aggregate({ ...query, fingerprint: ["state"] });
    expect(reference.count).toBe(1);
    const expected = { count: reference.count, groups: reference.groups };
    expect(await renamed.aggregate(query)).toMatchObject(expected);
    await defineRecordIndexes(fixture.db, { ...owner, extensionId: "pstdio.planner" }, [index], "host-index");
    expect(await renamed.aggregate(query)).toMatchObject(expected);
  } finally {
    await fixture.close();
  }
});
