import { expect, test } from "bun:test";
import type { RecordEdit } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("related viewer ordering selects the natural page before applying its continuation", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const records = createDocumentStorageDBService(fixture.db).open({
      owner: { workbenchId: fixture.projectAId, extensionId: "related-order" },
    }).records;
    await records.commit({
      operationId: "seed",
      edits: ["item1", "item10", "item11", "item2"].flatMap((label, i): RecordEdit[] => [
        { recordId: `thing/${i}`, replace: { id: String(i) } },
        { recordId: `label/${i}`, replace: { id: String(i), label } },
      ]),
    });
    await records.defineIndexes([
      {
        name: "things",
        prefix: "thing/",
        fields: {
          id: { path: ["id"], type: "string" },
          label: {
            type: "string",
            lookup: { index: "labels", on: [{ sourceField: "id", relatedField: "id" }], field: "label" },
          },
        },
      },
      {
        name: "labels",
        prefix: "label/",
        fields: { id: { path: ["id"], type: "string" }, label: { path: ["label"], type: "string" } },
        equality: ["id"],
      },
    ]);
    const query = {
      index: "things",
      fields: ["label"],
      limit: 2,
      orderBy: [{ field: "label", direction: "asc" as const }],
      textOrder: { field: "label", locale: "en-US" },
    };
    const labels = [];
    let cursor: string | undefined;
    do {
      const page = await records.query({ ...query, cursor });
      labels.push(...page.records.map(({ fields }) => fields.label));
      cursor = page.cursor ?? undefined;
    } while (cursor && labels.length < 6);
    expect(labels).toEqual(["item1", "item2", "item10", "item11"]);
  } finally {
    await fixture.close();
  }
});
