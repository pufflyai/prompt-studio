import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("indexed object key selection matches memory and filters before paging", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const host = createDocumentStorageDBService(fixture.db).open({
      owner: { workbenchId: fixture.projectAId, extensionId: "ext.example" },
    }).records;
    const memory = createMemoryStorage().records;
    const definition: StorageRecordIndex = {
      name: "properties",
      fields: { choices: { path: ["choices"], type: "object" } },
    };
    for (const records of [host, memory]) {
      await records.defineIndexes([definition]);
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "a", replace: { choices: { other: true } } },
          { recordId: "b", replace: { choices: { "selected\u0000😀": false } } },
          { recordId: "c", replace: { choices: "selected\u0000😀" } },
          { recordId: "d", replace: { choices: { "selected\u0000😀": ["one", "two"] } } },
          { recordId: "e", replace: { choices: ["selected\u0000😀"] } },
        ],
      });
      const where = { field: "choices", op: "hasKey" as const, value: "selected\u0000😀" };
      const first = await records.query({ index: "properties", where, fields: [], limit: 1 });
      expect(first.records.map(({ recordId }) => recordId)).toEqual(["b"]);
      const last = await records.query({ index: "properties", where, fields: [], limit: 1, cursor: first.cursor! });
      expect(last.records.map(({ recordId }) => recordId)).toEqual(["d"]);
      expect((await records.aggregate({ index: "properties", where })).count).toBe(2);
      await expect(
        records.query({ index: "properties", where: { field: "choices", op: "hasKey", value: 1 } }),
      ).rejects.toThrow();
    }
  } finally {
    await fixture.close();
  }
});

test("root projections and derived root conditions match memory after a record changes", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const host = createDocumentStorageDBService(fixture.db).open({
      owner: { workbenchId: fixture.projectAId, extensionId: "ext.root" },
    }).records;
    const memory = createMemoryStorage().records;
    const definition: StorageRecordIndex = {
      name: "root-values",
      fields: {
        body: { path: [], type: "object" },
        ready: {
          path: [],
          type: "boolean",
          derive: {
            kind: "expression",
            expression: {
              op: "eq",
              args: [{ get: { variable: "value" }, key: "state" }, { literal: "ready" }],
            },
          },
        },
      },
      equality: ["ready"],
    };
    const body = { state: "ready", "key\u0000😀": { text: "kept\u0000😀" } };
    for (const records of [host, memory]) {
      await records.defineIndexes([definition]);
      await records.commit({ operationId: "seed-root", edits: [{ recordId: "item", replace: body }] });
      const where = { field: "ready", op: "eq" as const, value: true };
      const page = await records.query({ index: "root-values", fields: ["body"], where, limit: 1 });
      expect(page.records.map(({ fields }) => fields.body)).toEqual([body]);
      expect((await records.aggregate({ index: "root-values", where })).count).toBe(1);
      await records.commit({
        operationId: "change-root",
        edits: [{ recordId: "item", replace: { ...body, state: "closed" } }],
      });
      expect((await records.aggregate({ index: "root-values", where })).count).toBe(0);
      expect(
        (await records.query({ index: "root-values", fields: ["body"], limit: 1 })).records[0]?.fields.body,
      ).toEqual({ ...body, state: "closed" });
    }
  } finally {
    await fixture.close();
  }
});
