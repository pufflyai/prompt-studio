import { expect, test } from "bun:test";
import type { StoragePredicate } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("identity query fields preserve encoded Unicode text and canonical aliases through renumbering", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const service = createDocumentStorageDBService(f.db),
      owner = { workbenchId: f.projectAId, extensionId: "identity-fields" };
    const records = service.open({ owner }).records,
      core = service.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
    await records.commit({ operationId: "resource", edits: [{ recordId: "a", replace: { id: "a" } }] });
    await core.commit({
      operationId: "number",
      edits: [
        {
          recordId: "a",
          replace: {
            id: "a",
            extensionId: owner.extensionId,
            kind: "thing",
            prefix: "ΟΣ",
            value: 1,
            aliases: ["OLD-1"],
          },
        },
      ],
    });
    await records.defineIndexes([
      {
        name: "things",
        fields: {
          id: { path: ["id"], type: "string" },
          shorthand: { path: ["unused"], type: "string" },
          aliases: { path: ["unused"], type: "array" },
        },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand", aliasesField: "aliases" },
      },
    ] as never);
    expect(
      (
        await records.query({
          index: "things",
          where: { field: "shorthand", op: "equalsIgnoreCase", value: "ΟΣ-1".toLowerCase() },
        })
      ).records[0]?.fields,
    ).toEqual({ id: "a", shorthand: "ΟΣ-1", aliases: ["OLD-1", "ΟΣ-1"] });
    await core.commit({
      operationId: "renumber",
      edits: [{ recordId: "a", set: { "/value": 2, "/aliases": ["OLD-1", "ΟΣ-1"] } }],
    });
    expect(
      (await records.query({ index: "things", where: { field: "shorthand", op: "eq", value: "ΟΣ-2" } })).records[0]
        ?.fields.aliases,
    ).toEqual(["OLD-1", "ΟΣ-1", "ΟΣ-2"]);
    for (const where of [
      { field: "shorthand", op: "in", value: ["missing", "ΟΣ-2", "\0", "\ud800"] },
      { field: "aliases", op: "contains", value: "OLD-1" },
      { field: "aliases", op: "overlaps", value: ["missing", "ΟΣ-1", "ΟΣ-2", "\0", "\ud800"] },
      {
        any: [
          { field: "id", op: "eq", value: "other" },
          { field: "aliases", op: "overlaps", value: ["OLD-1"] },
        ],
      },
    ] satisfies StoragePredicate[]) {
      expect(
        (await records.query({ index: "things", where, fields: [], limit: 1 })).records.map(({ recordId }) => recordId),
      ).toEqual(["a"]);
      expect((await records.aggregate({ index: "things", where })).count).toBe(1);
    }
    expect(
      (
        await records.aggregate({
          index: "things",
          where: { field: "aliases", op: "overlaps", value: ["\0", "\ud800"] },
        })
      ).count,
    ).toBe(0);
    await records.commit({
      operationId: "lookup",
      edits: [{ recordId: "names/a", replace: { id: "a", label: "LOOKUP-9", names: ["LOOKUP-8"] } }],
    });
    await records.defineIndexes([
      {
        name: "names",
        prefix: "names/",
        fields: {
          id: { path: ["id"], type: "string" },
          label: { path: ["label"], type: "string" },
          names: { path: ["names"], type: "array" },
        },
      },
      {
        name: "things",
        prefix: "a",
        fields: {
          id: { path: ["id"], type: "string" },
          shorthand: {
            type: "string",
            lookup: { index: "names", on: [{ sourceField: "id", relatedField: "id" }], field: "label" },
          },
          aliases: {
            type: "array",
            lookup: { index: "names", on: [{ sourceField: "id", relatedField: "id" }], field: "names" },
          },
        },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand", aliasesField: "aliases" },
      },
    ]);
    expect((await records.query({ index: "things" })).records[0]?.fields).toEqual({
      id: "a",
      shorthand: "LOOKUP-9",
      aliases: ["LOOKUP-8"],
    });
    for (const where of [
      { field: "shorthand", op: "eq", value: "LOOKUP-9" },
      { field: "aliases", op: "contains", value: "LOOKUP-8" },
      { field: "aliases", op: "overlaps", value: ["LOOKUP-8"] },
    ] satisfies StoragePredicate[]) {
      expect((await records.query({ index: "things", where })).records.map(({ recordId }) => recordId)).toEqual(["a"]);
    }
    expect(
      (await records.aggregate({ index: "things", where: { field: "shorthand", op: "eq", value: "ΟΣ-2" } })).count,
    ).toBe(0);
  } finally {
    await f.close();
  }
});
