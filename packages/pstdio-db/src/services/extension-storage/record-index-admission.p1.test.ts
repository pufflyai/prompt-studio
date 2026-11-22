import { expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("unchanged index admission checks catalog identities without reloading every definition", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const catalog: string[] = [];
    const maintenance: string[] = [];
    const db = drizzle(f.db.$client, {
      schema,
      logger: {
        logQuery: (query) => {
          if (/^analyze/i.test(query)) maintenance.push(query);
          if (query.startsWith("select") && query.includes('"record_index_rows"')) catalog.push(query);
        },
      },
    });
    const records = createDocumentStorageDBService(db).open({
      owner: { workbenchId: f.projectAId, extensionId: "ext.example" },
    }).records;
    const definition = {
      name: "items",
      prefix: "first/",
      fields: { title: { path: ["title"], type: "string" as const } },
    };
    await records.defineIndexes([definition]);
    expect(maintenance).toEqual([]);
    await records.commit({
      operationId: "seed",
      edits: ["first", "second"].map((name) => ({ recordId: `${name}/item`, replace: { title: name } })),
    });
    catalog.length = 0;
    await records.defineIndexes([definition]);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].split(" from ")[0]).not.toContain('"definition"');
    expect((await records.query({ index: "items" })).records.map(({ recordId }) => recordId)).toEqual(["first/item"]);
    await records.defineIndexes([{ ...definition, prefix: "second/" }]);
    expect((await records.query({ index: "items" })).records.map(({ recordId }) => recordId)).toEqual(["second/item"]);
  } finally {
    await f.close();
  }
});
