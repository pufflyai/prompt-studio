import { expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../db/schemas.pg";
import { attachDocumentFiles, documentFilesFor } from "./document-files";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { type OrderedFieldMarker, orderedFieldMarkerId, readOrderedMarker } from "./ordered-native-metadata";

test("bulk property saves preserve native text without a marker query per ticket", async () => {
  const f = await createExtensionStorageFixture();
  try {
    let markerReads = 0;
    const db = drizzle(f.db.$client, {
      schema,
      logger: {
        logQuery: (query, params) => {
          if (
            query.startsWith("select") &&
            query.includes('"storage_documents"') &&
            params.some((value) => typeof value === "string" && value.startsWith('["ordered-native-field",'))
          )
            markerReads++;
        },
      },
    });
    attachDocumentFiles(db, documentFilesFor(f.db));
    const service = createDocumentStorageDBService(db);
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    const records = service.open({ owner }).records;
    const ids = Array.from({ length: 32 }, (_, i) => `ticket-${i}`);
    await records.commit({
      operationId: "seed",
      edits: ids.map((recordId) => ({ recordId, replace: { content: `Original ${recordId}`, archived: false } })),
    });
    const sources = [];
    for (const [i, recordId] of ids.entries())
      sources.push(
        await records.bindText({ recordId, field: "/content", documentKey: i.toString(16).padStart(64, "0") }),
      );
    markerReads = 0;
    await records.commit({
      operationId: "archive",
      edits: ids.map((recordId) => ({ recordId, set: { "/archived": true } })),
    });
    expect(markerReads).toBeLessThanOrEqual(2);
    for (const [i, source] of sources.entries())
      expect(await service.openNativeTextDocument({ owner, fileId: source.documentKey }).read()).toBe(
        `Original ${ids[i]}`,
      );
    expect((await records.readMany(ids)).every((record) => (record.value as { archived: boolean }).archived)).toBe(
      true,
    );
  } finally {
    await f.close();
  }
}, 30_000);

test("a shared native key retains the sequential marker result when an earlier alias retires", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    const service = createDocumentStorageDBService(f.db);
    const records = service.open({ owner }).records;
    await records.commit({
      operationId: "seed",
      edits: ["first", "second"].map((recordId) => ({ recordId, replace: { content: "Shared" } })),
    });
    const first = await records.bindText({ recordId: "first", field: "/content", documentKey: "a".repeat(64) });
    const second = await records.bindText({ recordId: "second", field: "/content", documentKey: "a".repeat(64) });
    expect(first.documentKey).toBe(second.documentKey);
    const before = await readOrderedMarker<OrderedFieldMarker>(f.db, owner, orderedFieldMarkerId(second.documentKey));
    await records.commit({
      operationId: "retire-one",
      edits: [
        { recordId: "first", deleted: true },
        { recordId: "second", set: { "/archived": true } },
      ],
    });
    const after = await readOrderedMarker<OrderedFieldMarker>(f.db, owner, orderedFieldMarkerId(second.documentKey));
    expect(after?.value.recordId).toBe("second");
    expect(after?.value.textVersion).toBe(before?.value.textVersion);
  } finally {
    await f.close();
  }
});

test("publishing selected records reads only prior lifecycle metadata, not old ticket bodies", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const { withOrderedOwner } = await import("./ordered-journal");
    const { publishOrderedProjection } = await import("./ordered-projection");
    const selects: string[] = [];
    const db = drizzle(f.db.$client, {
      schema,
      logger: {
        logQuery: (query) => {
          if (query.startsWith("select")) selects.push(query);
        },
      },
    });
    attachDocumentFiles(db, documentFilesFor(f.db));
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    await createDocumentStorageDBService(db)
      .open({ owner })
      .records.commit({
        operationId: "seed",
        edits: [{ recordId: "ticket", replace: { content: "Large ticket body".repeat(500) } }],
      });
    await withOrderedOwner(db, owner, async (journal, tx) => {
      const records = [...(await journal.canonical(["ticket"])).values()];
      selects.length = 0;
      await publishOrderedProjection(tx, owner, records);
    });
    const previous = selects.filter((query) => query.includes('from "records"'));
    expect(previous).toHaveLength(1);
    expect(previous[0].split(" from ")[0]).not.toMatch(/"(?:value|query_values|revision|asset|shared)"/);
    expect(previous[0]).toContain('"native_sources"');
  } finally {
    await f.close();
  }
});
