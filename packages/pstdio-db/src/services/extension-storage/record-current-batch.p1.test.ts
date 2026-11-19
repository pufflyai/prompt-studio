import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { drizzle } from "drizzle-orm/pglite";
import { resolveCollectionIndexes } from "pstdio-api-contracts";
import * as schema from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

for (const backend of ["database", "memory"] as const)
  test(`${backend} conditional batches guard the selected revision without replacing bodies`, async () => {
    const fixture = await createExtensionStorageFixture();
    try {
      const native = await fixture.svc.open({ owner: { workbenchId: fixture.projectAId, extensionId: "ext.example" } });
      const records =
        backend === "database" ? native.scopedRecords("project", fixture.projectAId) : createMemoryStorage().records;
      const definitions = [
        {
          name: "cards",
          collection: "cards",
          fields: {
            id: { path: ["id"], type: "string" as const },
            archived: { path: ["archived"], type: "boolean" as const },
          },
          equality: ["archived"],
        },
      ];
      await records.defineIndexes(
        backend === "database" ? resolveCollectionIndexes(definitions, "project", fixture.projectAId) : definitions,
      );
      const ids = ["a", "b"].map((id) =>
        backend === "database"
          ? JSON.stringify(["project", fixture.projectAId, "collection", "cards", id])
          : JSON.stringify(["project", JSON.parse(records.id("scope"))[1], "collection", "cards", id]),
      );
      await records.commit({
        operationId: "seed",
        edits: ids.map((recordId, index) => ({
          recordId,
          replace: { value: { id: index ? "b" : "a", archived: false, content: "Original" }, sortOrder: null },
        })),
      });
      const selection = () =>
        records.query({ index: "cards", fields: [], where: { field: "archived", op: "eq", value: false } });
      const request = (rows: Awaited<ReturnType<typeof selection>>["records"], operationId: string) => ({
        operationId,
        edits: rows.map(({ recordId, revision }) => ({
          recordId,
          expectedRevision: revision,
          set: { "/value/archived": true },
        })),
      });
      const stale = await selection();
      await records.commit({
        operationId: "concurrent-body",
        edits: [{ recordId: ids[0]!, set: { "/value/content": "Concurrent body" } }],
      });
      expect(await records.commitIfCurrent(request(stale.records, "stale"))).toBeNull();
      expect((await selection()).records).toHaveLength(2);
      const current = await selection();
      const input = request(current.records, "archive");
      const saved = await records.commitIfCurrent(input);
      expect(saved?.state).toBe("saved-locally");
      expect(await records.commitIfCurrent(input)).toEqual(saved);
      expect((await records.read(ids[0]!)).value).toMatchObject({
        value: { archived: true, content: "Concurrent body" },
      });
      await expect(
        records.commitIfCurrent({
          ...input,
          edits: input.edits.map((edit) => ({ ...edit, set: { "/value/archived": false } })),
        }),
      ).rejects.toThrow("identity");
      const removed = await records.read(ids[0]!);
      await records.commit({ operationId: "delete", edits: [{ recordId: ids[0]!, deleted: true }] });
      expect(
        await records.commitIfCurrent({
          operationId: "after-delete",
          edits: [{ recordId: ids[0]!, expectedRevision: removed.revision, set: { "/value/archived": false } }],
        }),
      ).toBeNull();
      await expect(
        records.commitIfCurrent({ operationId: "too-many", edits: Array.from({ length: 101 }, () => input.edits[0]!) }),
      ).rejects.toThrow("100");
    } finally {
      await fixture.close();
    }
  });

test("conditional saves compare revisions without materializing projected bodies", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const queries: string[] = [];
    const db = drizzle(f.db.$client, {
      schema,
      logger: {
        logQuery: (query) => {
          if (query.startsWith("select") && query.includes('from "storage_current_records"')) queries.push(query);
        },
      },
    });
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    const service = createDocumentStorageDBService(db);
    const records = service.open({ owner }).records;
    const ids = Array.from({ length: 32 }, (_, i) => `ticket-${i}`);
    await records.commit({
      operationId: "seed",
      edits: ids.map((recordId) => ({
        recordId,
        replace: { archived: false, content: recordId.repeat(10) },
      })),
    });
    const selected = await records.readMany(ids);
    await records.commit({ operationId: "other", edits: [{ recordId: "other", replace: { title: "Other" } }] });
    queries.length = 0;
    const saved = await records.commitIfCurrent({
      operationId: "archive",
      edits: selected.map((record) => ({
        recordId: record.recordId,
        expectedRevision: record.revision,
        set: { "/archived": true },
      })),
    });
    await service.flushStatistics();
    expect(saved?.state).toBe("saved-locally");
    expect(queries.length).toBeGreaterThan(0);
    expect(
      queries.every((query) => !query.includes('"value"') && !query.includes('"shared"') && !query.includes('"asset"')),
    ).toBe(true);
    expect((await records.read(ids[0])).value).toEqual({ archived: true, content: ids[0].repeat(10) });
  } finally {
    await f.close();
  }
});
