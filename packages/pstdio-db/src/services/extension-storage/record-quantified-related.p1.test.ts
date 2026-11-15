import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("every source key needs one uniquely matching scoped relationship before paging or counting", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "quantified" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "source/a", replace: { names: ["old-1", "X-2"], ids: ["b", "c"] } },
          { recordId: "source/b", replace: { names: ["old-1"], ids: ["b", "d"] } },
          { recordId: "target/b", replace: { id: "b", names: ["OLD-1"] } },
          { recordId: "target/c", replace: { id: "c", names: ["X-2"] } },
          { recordId: "target/d", replace: { id: "d", names: ["OLD-1"] } },
        ],
      });
      await records.defineIndexes([
        {
          name: "sources",
          prefix: "source/",
          fields: { names: { path: ["names"], type: "array" }, ids: { path: ["ids"], type: "array" } },
        },
        {
          name: "targets",
          prefix: "target/",
          fields: { id: { path: ["id"], type: "string" }, names: { path: ["names"], type: "array" } },
          equality: ["id"],
        },
      ]);
      const where = {
        exists: {
          index: "targets",
          on: [{ sourceField: "ids", relatedField: "id", op: "contains" }],
          every: { field: "names", as: "name", matches: "one" },
          where: {
            test: {
              each: { field: "names" },
              as: "candidate",
              mode: "some",
              where: { op: "equalsIgnoreCase", args: [{ variable: "candidate" }, { variable: "name" }] },
            },
          },
        },
      };
      expect(
        (await records.query({ index: "sources", where, fields: [], limit: 1 } as never)).records.map(
          ({ recordId }) => recordId,
        ),
      ).toEqual(["source/a"]);
      expect((await records.aggregate({ index: "sources", where } as never)).count).toBe(1);
    }
  } finally {
    await f.close();
  }
});
