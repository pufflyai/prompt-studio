import { expect, test } from "bun:test";
import { DEFAULT_DATA_TABLE_SETTINGS, type ViewFilterRule } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createPagedCollectionFixture, initialFixturePage, queryFixturePage } from "./paged-collection-extension";

test("paged text controls preserve case, empty values, totals, and selected fields", async () => {
  const extension = createPagedCollectionFixture("owner");
  const storage = createMemoryStorage({ indexes: extension.storageIndexes });
  const titles = ["Alpha", "ALPHA beta", "other", null, undefined, ""];
  await storage.records.commit({
    operationId: "seed",
    edits: titles.map((title, rank) => ({
      recordId: `row-${rank}`,
      replace: { ...(title !== undefined && { title }), rank, status: "todo", body: "not selected" },
    })),
  });
  const cases: [ViewFilterRule["condition"], ViewFilterRule["value"], string[]][] = [
    ["is", "ALPHA", ["row-0"]],
    ["is-not", "ALPHA", ["row-1", "row-2", "row-3", "row-4", "row-5"]],
    ["contains", "ALPHA", ["row-0", "row-1"]],
    ["does-not-contain", "ALPHA", ["row-2", "row-3", "row-4", "row-5"]],
    ["is-empty", undefined, ["row-3", "row-4", "row-5"]],
    ["is-not-empty", undefined, ["row-0", "row-1", "row-2"]],
    ["contains", "", titles.map((_, index) => `row-${index}`)],
    ["is", "", titles.map((_, index) => `row-${index}`)],
  ];
  for (const [condition, value, ids] of cases) {
    const result = await queryFixturePage(
      { storage },
      {
        renderer: { projectId: "project" },
        filter: { conjunction: "and", rules: [{ attributeId: "title", condition, value }] },
        sorts: [{ attributeId: "rank", direction: "asc" }],
        settings: { ...DEFAULT_DATA_TABLE_SETTINGS, showStats: false },
        page: initialFixturePage,
      },
    );
    expect(result.records.map((row) => row.recordId)).toEqual(ids);
    expect(result.page.total).toBe(ids.length);
    expect(result.page.filteredTotal).toBe(ids.length);
    expect(JSON.stringify(result)).not.toContain("not selected");
  }
});
