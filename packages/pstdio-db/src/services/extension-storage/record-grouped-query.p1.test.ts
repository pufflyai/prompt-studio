import { expect, test } from "bun:test";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { aggregateRecordQuery } from "./record-aggregate-query";
import { readQueryOwner } from "./record-query-owner";
import { recordScopeSql } from "./record-query-sql";

test("grouped counts and numeric totals share one database selection", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "grouped" };
    const records = createDocumentStorageDBService(f.db).open({ owner }).records;
    const index: StorageRecordIndex = {
      name: "items",
      fields: { group: { path: ["group"], type: "string" }, amount: { path: ["amount"], type: "number" } },
    };
    await records.commit({
      operationId: "seed",
      edits: [
        { recordId: "a", replace: { group: "x", amount: 2 } },
        { recordId: "b", replace: { group: "x", amount: 3 } },
        { recordId: "c", replace: { group: "y", amount: null } },
        { recordId: "d", replace: { group: "z", amount: -7 } },
        { recordId: "e", replace: { group: "e", amount: 0.1 } },
        { recordId: "f", replace: { group: "f", amount: 0.2 } },
      ],
    });
    let selections = 0;
    const execute: typeof f.db.execute = (query) => {
      selections++;
      return f.db.execute(query);
    };
    const result = await aggregateRecordQuery(
      { execute },
      index,
      {
        index: "items",
        groupBy: "group",
        metrics: {
          sum: { operation: "sum", field: "amount" },
          min: { operation: "min", field: "amount" },
          max: { operation: "max", field: "amount" },
        },
      },
      "revision",
      recordScopeSql(await readQueryOwner(f.db, owner), index),
      undefined,
      owner,
    );
    expect(result.count).toBe(6);
    expect(result.metrics).toEqual({ sum: -1.7, min: -7, max: 3 });
    expect(result.groups).toContainEqual({ value: "y", count: 1, metrics: { sum: 0, min: null, max: null } });
    expect(selections).toBe(1);
  } finally {
    await f.close();
  }
});
