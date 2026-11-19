import { expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("a local bulk save reads its selected canonical bodies once across compilation and settlement", async () => {
  const f = await createExtensionStorageFixture();
  try {
    let reads = 0;
    const db = drizzle(f.db.$client, {
      schema,
      logger: {
        logQuery: (query) => {
          if (query.startsWith("select") && query.includes('from "storage_ordered_records"')) reads++;
        },
      },
    });
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    const service = createDocumentStorageDBService(db);
    const records = service.open({ owner }).records;
    const ids = Array.from({ length: 32 }, (_, i) => `ticket-${i}`);
    await records.commit({
      operationId: "seed",
      edits: ids.map((recordId) => ({ recordId, replace: { archived: false, content: recordId.repeat(10) } })),
    });
    // The retained cross-command cache belongs to another authored group.
    await records.commit({ operationId: "unrelated", edits: [{ recordId: "other", replace: { title: "Other" } }] });
    reads = 0;
    await records.commit({
      operationId: "archive",
      edits: ids.map((recordId) => ({ recordId, set: { "/archived": true } })),
    });
    await service.flushStatistics();
    expect(reads).toBeLessThanOrEqual(1);
    expect((await records.readMany(ids)).every((record) => (record.value as { archived: boolean }).archived)).toBe(
      true,
    );
    const reopened = createDocumentStorageDBService(db).open({ owner }).records;
    expect((await reopened.readMany([ids[0]]))[0].value).toEqual({ archived: true, content: ids[0].repeat(10) });
  } finally {
    await f.close();
  }
});
