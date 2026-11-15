import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("hierarchy text preserves Unicode, surrogate boundaries and complete-string case folding", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const labels = ["", " \t", "ΟΣ", "Α", "\ud83d", "\ude00", "B\0é", "\ue0007\ue001İ"];
    for (const separator of ["/", "", "\u0301"]) {
      const outputs = [];
      for (const records of [
        createDocumentStorageDBService(fixture.db).open({
          owner: { workbenchId: fixture.projectAId, extensionId: `hierarchy-${separator.length}` },
        }).records,
        createMemoryStorage().records,
      ]) {
        await records.commit({
          operationId: `seed-${separator}`,
          edits: labels.map((label, i) => ({
            recordId: String(i),
            replace: { id: String(i), label, parent: i ? String(i - 1) : null },
          })),
        });
        await records.defineIndexes([
          {
            name: "nodes",
            hierarchy: {
              idField: "id",
              parentField: "parent",
              labelField: "label",
              breadcrumbField: "breadcrumb",
              separator,
            },
            fields: {
              id: { type: "string", path: ["id"] },
              parent: { type: "string", path: ["parent"] },
              label: { type: "string", path: ["label"] },
              breadcrumb: { type: "string", path: ["unused"] },
            },
            equality: ["id"],
          },
        ]);
        const page = await records.query({
          index: "nodes",
          fields: ["id", "breadcrumb"],
          orderBy: [{ field: "breadcrumb", direction: "asc" }],
          limit: 100,
        });
        const folded = await records.query({
          index: "nodes",
          fields: ["id"],
          where: { field: "breadcrumb", op: "contains", value: labels.join(separator).toLowerCase() },
          limit: 100,
        });
        const grouped = await records.aggregate({
          index: "nodes",
          computed: {
            choice: {
              type: "string",
              expression: {
                op: "if",
                args: [
                  { op: "eq", args: [{ field: "id" }, { literal: "0" }] },
                  { literal: labels.slice(0, 2).join(separator) },
                  { field: "breadcrumb" },
                ],
              },
            },
          },
          groupBy: "choice",
        });
        const selections = [];
        for (const where of [
          { field: "breadcrumb", op: "empty" as const },
          { field: "breadcrumb", op: "notEmpty" as const },
          { exists: { index: "nodes", on: [{ sourceField: "breadcrumb", relatedField: "label" }] } },
        ])
          selections.push(
            (await records.query({ index: "nodes", fields: ["id"], where, limit: 100 })).records.map(
              ({ fields }) => fields.id,
            ),
          );
        outputs.push({
          rows: page.records.map(({ fields }) => fields),
          folded: folded.records.map(({ fields }) => fields),
          selections,
          groups: grouped.groups,
        });
      }
      expect(outputs[0]).toEqual(outputs[1]);
      expect(outputs[0].rows.find((row) => row.id === "7")?.breadcrumb).toBe(labels.join(separator));
    }
  } finally {
    await fixture.close();
  }
});
