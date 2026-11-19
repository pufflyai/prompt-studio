import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("maintained counts follow both identity halves, field changes, overlong groups and teardown", async () => {
  const f = await createExtensionStorageFixture();
  const store = createDocumentStorageDBService(f.db);
  const owner = { workbenchId: f.projectAId, extensionId: "counts.example" };
  const rows = store.open({ owner }).records;
  const core = store.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
  const category = "group'λ";
  const definition: StorageRecordIndex = {
    name: "view",
    identity: { kind: "thing", idField: "id", shorthandField: "label" },
    fields: {
      id: { type: "string", path: ["id"] },
      label: { type: "string", path: ["unused"] },
      [category]: {
        type: "string",
        path: ["group"],
        derive: { kind: "expression", expression: { variable: "value" } },
      },
    },
    countBy: [category],
    alternateOrders: [[{ field: category, direction: "desc" }]],
  };
  const group = async () => {
    const selection = { index: "view", groupBy: [category] };
    const actual = await rows.aggregate(selection);
    // A separate index without count metadata independently checks both visibility and groups.
    const reference = await rows.aggregate({ ...selection, index: "reference", fingerprint: ["id"] });
    expect(actual.count).toEqual(reference.count);
    expect(actual.groups).toEqual(reference.groups);
    return actual.count;
  };
  try {
    const allocated = { id: "a", extensionId: owner.extensionId, kind: "thing", prefix: "T", value: 1, aliases: [] };
    await rows.commit({
      operationId: "before-index",
      edits: [{ recordId: "1", replace: { id: "a", group: "first" } }],
    });
    await rows.defineIndexes([
      definition,
      { ...definition, name: "reference", countBy: undefined, alternateOrders: undefined },
    ]);
    expect(await group()).toBe(0);
    await core.commit({ operationId: "identity-arrives", edits: [{ recordId: "a", replace: allocated }] });
    expect(await group()).toBe(1);
    await rows.commit({ operationId: "second", edits: [{ recordId: "2", replace: { id: "a", group: "second" } }] });
    expect(await group()).toBe(2);
    await rows.commit({
      operationId: "oversize",
      edits: [{ recordId: "1", set: { "/group": randomBytes(4000).toString("hex") } }],
    });
    expect(await group()).toBe(2);
    await rows.commit({
      operationId: "unmatched",
      edits: [{ recordId: "1", set: { "/id": randomBytes(5000).toString("hex") } }],
    });
    expect(await group()).toBe(1);
    await rows.commit({ operationId: "delete", edits: [{ recordId: "2", deleted: true }] });
    expect(await group()).toBe(0);
    await rows.defineIndexes([]);
    expect(
      (await f.db.execute(sql`select relname from pg_class where relname like 'storage_query_v4_%'`)).rows,
    ).toEqual([]);
  } finally {
    await f.close();
  }
}, 30000);
