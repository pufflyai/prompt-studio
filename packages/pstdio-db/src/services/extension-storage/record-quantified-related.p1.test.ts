import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageExpression } from "pstdio-sync-contracts";
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
          fields: {
            context: { path: [], type: "string", derive: { kind: "expression", expression: { literal: "links" } } },
            names: { path: ["names"], type: "array" },
            ids: { path: ["ids"], type: "array" },
          },
        },
        {
          name: "targets",
          prefix: "target/",
          fields: {
            context: { path: [], type: "string", derive: { kind: "expression", expression: { literal: "links" } } },
            id: { path: ["id"], type: "string" },
            label: { path: ["label"], type: "string" },
            names: { path: ["names"], type: "array" },
          },
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
      await records.commit({
        operationId: "mixed-links",
        edits: [
          { recordId: "source/a", set: { "/ids": ["B", "C-1", "b"] } },
          { recordId: "source/b", set: { "/ids": ["shared", "SHARED"] } },
          { recordId: "target/b", set: { "/label": "shared" } },
          { recordId: "target/c", set: { "/label": "C-1" } },
          { recordId: "target/d", set: { "/label": "SHARED" } },
          { recordId: "source/c", replace: { names: ["\0", "ΟΣ-1", "\ud800"], ids: ["\0", "ος-1", "\ud800"] } },
          { recordId: "source/e", replace: { names: [], ids: [] } },
          { recordId: "source/f", replace: { names: ["X-2"], ids: ["missing"] } },
          ...["\0", "ΟΣ-1", "\ud800"].map((id, i) => ({ recordId: `target/u${i}`, replace: { id, names: [id] } })),
        ],
      });
      const match: StorageExpression = {
        each: { field: "ids", up: 1 },
        as: "ref",
        mode: "some",
        where: {
          op: "or",
          args: [
            { op: "equalsIgnoreCase", args: [{ variable: "ref" }, { field: "id" }] },
            { op: "equalsIgnoreCase", args: [{ field: "label" }, { variable: "ref" }] },
          ],
        },
      };
      const linked = {
        exists: {
          ...where.exists,
          on: [{ sourceField: "context", relatedField: "context" }],
          where: { all: [{ test: match }, where.exists.where] },
        },
      };
      const selected = async (condition: unknown = linked) =>
        (await records.query({ index: "sources", where: condition, fields: [] } as never)).records
          .map(({ recordId }) => recordId)
          .sort();
      expect(await selected()).toEqual(["source/a", "source/c", "source/e"]);
      expect((await records.aggregate({ index: "sources", where: linked } as never)).count).toBe(3);
      const unsupported = structuredClone(linked);
      (unsupported.exists.where.all[0]!.test as typeof match).where = {
        op: "or",
        args: [match.where, { literal: true }],
      };
      expect(await selected(unsupported)).toEqual(["source/c", "source/e", "source/f"]);
      await records.commit({ operationId: "rename", edits: [{ recordId: "target/c", set: { "/label": "C-2" } }] });
      expect(await selected()).toEqual(["source/c", "source/e"]);
      await records.commit({
        operationId: "over-budget",
        edits: [{ recordId: "source/g", replace: { names: ["X-2"], ids: Array(20_000).fill("missing") } }],
      });
      expect(await selected().catch((error) => String(error.cause ?? error))).toMatch(
        /Query expression execution limit exceeded|invalid input syntax for type json/,
      );
    }
  } finally {
    await f.close();
  }
});
