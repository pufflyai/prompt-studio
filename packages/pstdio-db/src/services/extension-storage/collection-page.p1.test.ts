import { expect, test } from "bun:test";
import { readCollectionPage } from "@pstdio/sdk/data";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("a new resource's page selects and counts 5,000 records without materializing the collection", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const materialized: number[] = [];
    const records = createDocumentStorageDBService(f.db, undefined, (event) => {
      if (event.phase === "records-queried") materialized.push(event.materialized ?? 0);
    }).open({
      owner: { workbenchId: f.projectAId, extensionId: "ext.example" },
    }).records;
    await records.defineIndexes([
      {
        name: "foobar",
        prefix: "foobar/",
        fields: {
          rank: { path: ["rank"], type: "number" },
          state: { path: ["state"], type: "string" },
        },
        orderBy: [{ field: "rank", direction: "asc" }],
      },
    ]);
    await records.commit({
      operationId: "seed",
      edits: Array.from({ length: 5000 }, (_, rank) => ({
        recordId: `foobar/${rank}`,
        replace: { rank, state: rank >= 4800 ? "late" : "other", body: "x".repeat(128) },
      })),
    });
    const selection = {
      index: "foobar",
      fields: ["rank"],
      search: { field: "state", op: "eq" as const, value: "late" },
      orderBy: [{ field: "rank", direction: "desc" as const }],
      groups: [{ field: "status", indexField: "state" }],
    };
    const first = await readCollectionPage({ records }, selection);
    expect(first.records).toHaveLength(100);
    expect(first.records[0].fields).toEqual({ rank: 4999 });
    expect(first.records.at(-1)?.fields).toEqual({ rank: 4900 });
    expect(first.page.total).toBe(5000);
    expect(first.page.filteredTotal).toBe(200);
    expect(first.page.groups).toEqual([{ field: "status", value: "late", count: 200 }]);
    expect(materialized).toContain(101);
    expect(Math.max(...materialized)).toBeLessThanOrEqual(101);
    const second = await readCollectionPage(
      { records },
      {
        ...selection,
        page: {
          limit: 100,
          offset: 0,
          fields: [],
          search: "late",
          cursor: first.page.cursor!,
          revision: first.page.revision,
        },
      },
    );
    expect(second.records[0].fields).toEqual({ rank: 4899 });
    expect(second.records.at(-1)?.fields).toEqual({ rank: 4800 });
    expect(second.page.cursor).toBeNull();
  } finally {
    await f.close();
  }
});

test("index replacement between global counts and a database page rejects the mixed scope", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const records = createDocumentStorageDBService(f.db).open({
      owner: { workbenchId: f.projectAId, extensionId: "ext.example" },
    }).records;
    const definition = { name: "items", prefix: "a/", fields: { rank: { path: ["rank"], type: "number" as const } } };
    await records.defineIndexes([definition]);
    await records.commit({
      operationId: "seed",
      edits: [
        { recordId: "a/one", replace: { rank: 1 } },
        { recordId: "a/two", replace: { rank: 2 } },
        { recordId: "b/other", replace: { rank: 3 } },
      ],
    });
    const aggregate = records.aggregate;
    records.aggregate = async (input) => {
      const result = await aggregate(input);
      await records.defineIndexes([{ ...definition, prefix: "b/" }]);
      return result;
    };
    await expect(readCollectionPage({ records }, { index: "items" })).rejects.toThrow("stale");
  } finally {
    await f.close();
  }
});
