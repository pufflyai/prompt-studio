import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { resource_numbers } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { defineRecordIndexes } from "./record-index-definition";

test.each([
  "query",
  "host-index",
] as const)("counts follow both identity halves, field changes, overlong groups and teardown (%s)", async (kind) => {
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
  const define = (definitions: StorageRecordIndex[]) => defineRecordIndexes(f.db, owner, definitions, kind);
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
    await define([definition, { ...definition, name: "reference", countBy: undefined, alternateOrders: undefined }]);
    expect(await group()).toBe(0);
    await withOrderedOwner(f.db, { ...owner, extensionId: "pstdio" }, async (journal) =>
      journal.saveCanonical([
        {
          recordId: "a",
          value: { value: allocated },
          deleted: false,
          lifetime: "initial",
          stamps: { "": JSON.stringify(["canonical", "local", "a"]) },
        },
      ]),
    );
    await f.db.insert(resource_numbers).values({
      project_id: owner.workbenchId,
      resource_id: "a",
      shorthand: "T-1",
      extension_id: owner.extensionId,
      kind: "thing",
      prefix: "T",
      value: 1,
      current: true,
      alias: true,
    });
    // Backfill and live count triggers must require the core query facet, too.
    expect((await rows.query({ index: "view" })).records).toEqual([]);
    expect(await group()).toBe(0);
    await define([]);
    await define([definition, { ...definition, name: "reference", countBy: undefined, alternateOrders: undefined }]);
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
    await define([]);
    expect((await f.db.execute(sql`select relname from pg_class where relname like 'storage_host_v4_%'`)).rows).toEqual(
      [],
    );
  } finally {
    await f.close();
  }
}, 30000);
