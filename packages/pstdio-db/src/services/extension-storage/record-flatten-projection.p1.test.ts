import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("nested relationship IDs project to a flat membership field without hydrating histories", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const native = createDocumentStorageDBService(fixture.db).open({
      owner: { workbenchId: fixture.projectAId, extensionId: "flatten" },
    }).records;
    for (const records of [native, createMemoryStorage().records]) {
      await records.defineIndexes([
        {
          name: "links",
          fields: {
            object: { path: ["payload"], type: "object" },
            sessions: {
              path: ["payload", "groups"],
              type: "array",
              derive: { kind: "expression", expression: { op: "flatten", args: [{ variable: "value" }] } },
            },
          },
        },
      ]);
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "linked", replace: { payload: { groups: [["owner"], [], ["review\0", "\ud800"]] } } },
          { recordId: "empty", replace: { payload: { groups: [] } } },
          { recordId: "missing", replace: {} },
        ],
      });
      const page = await records.query({
        index: "links",
        where: { field: "sessions", op: "contains", value: "review\0" },
        fields: ["sessions"],
        limit: 1,
      });
      expect(page.records.map(({ recordId }) => recordId)).toEqual(["linked"]);
      expect(page.records[0].fields.sessions).toEqual(["owner", "review\0", "\ud800"]);
      const dynamic = await records.query({
        index: "links",
        computed: {
          flat: { type: "array", expression: { op: "flatten", args: [{ get: { field: "object" }, key: "groups" }] } },
        },
        fields: ["flat"],
        orderBy: [],
        limit: 3,
      });
      expect(dynamic.records.map(({ fields }) => fields.flat)).toEqual([[], ["owner", "review\0", "\ud800"], null]);
    }
  } finally {
    await fixture.close();
  }
});
