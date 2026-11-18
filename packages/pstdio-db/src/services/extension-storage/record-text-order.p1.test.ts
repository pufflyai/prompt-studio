import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageRecordQueries, StorageRecordQuery } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const unsafeLabels = new Set(["a\0b", "\ud800", "\udfff"]);
const compareLabels = (a: string, b: string, locale: string) => {
  if (unsafeLabels.has(a) !== unsafeLabels.has(b)) return Number(unsafeLabels.has(a)) - Number(unsafeLabels.has(b));
  if (!unsafeLabels.has(a)) return a.localeCompare(b, locale, { numeric: true, sensitivity: "base" });
  if (a < b) return -1;
  return Number(a > b);
};
const expectedOrder = (labels: (string | null)[], locale: string, direction: "asc" | "desc") =>
  labels
    .map((label, rank) => ({ label, rank }))
    .sort((a, b) => {
      if (a.label === null || b.label === null) return Number(a.label === null) - Number(b.label === null);
      return compareLabels(a.label, b.label, locale) * (direction === "asc" ? 1 : -1) || a.rank - b.rank;
    })
    .map(({ rank }) => String(rank));

const checkTopLabels = async (records: StorageRecordQueries, labels: (string | null)[]) => {
  for (const locale of ["en-US", "en-u-kf-upper"]) {
    const top = await records.aggregate({
      index: "labels",
      statistics: { labels: { field: "label", type: "top-values", limit: 100, locale } },
    });
    const statistic = top.statistics!.labels;
    if (statistic.type !== "top-values") throw new Error("Missing labels");
    const expectedLabels = labels
      .filter((label): label is string => label !== null)
      .sort((a, b) => {
        if (unsafeLabels.has(a) || unsafeLabels.has(b)) return compareLabels(a, b, locale);
        return a.localeCompare(b, locale);
      });
    expect(statistic.values.map(({ label }) => label)).toEqual(expectedLabels);
  }
};

test("viewer text ordering preserves natural localized order, stable ties and cursor boundaries", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const native = createDocumentStorageDBService(fixture.db).open({
      owner: { workbenchId: fixture.projectAId, extensionId: "text-sort" },
    }).records;
    const labels = [
      "Ticket 10",
      "ticket 2",
      "Ticket 1",
      "Éclair",
      "eclair",
      "ä",
      "z",
      "å",
      "Ö",
      "o",
      "😀2",
      "😀10",
      "a\0b",
      "\ud800",
      "\udfff",
      "�",
      null,
    ];
    for (const records of [native, createMemoryStorage().records]) {
      await records.defineIndexes([
        {
          name: "labels",
          fields: { label: { path: ["label"], type: "string" }, rank: { path: ["rank"], type: "number" } },
          orderBy: [
            { field: "label", direction: "asc" },
            { field: "rank", direction: "asc" },
          ],
        },
      ]);
      await records.commit({
        operationId: "seed",
        edits: labels.map((label, rank) => ({ recordId: String(rank), replace: { label, rank } })),
      });
      for (const locale of ["en-US", "de-DE", "sv-SE"]) {
        for (const direction of ["asc", "desc"] as const) {
          const expected = expectedOrder(labels, locale, direction);
          const query: StorageRecordQuery = {
            index: "labels",
            textOrder: { field: "label", locale },
            fields: ["label"],
            limit: 3,
            orderBy: [
              { field: "label", direction },
              { field: "rank", direction: "asc" },
            ],
          };
          const ids: string[] = [];
          let cursor: string | undefined;
          for (let i = 0; i < labels.length; i++) {
            const page = await records.query({ ...query, cursor });
            ids.push(...page.records.map(({ recordId }) => recordId));
            if (!page.cursor) break;
            cursor = page.cursor;
          }
          expect(ids).toEqual(expected);
          expect((await records.query({ ...query, offset: 3 })).records.map(({ recordId }) => recordId)).toEqual(
            expected.slice(3, 6),
          );
        }
      }
      // Locale selection is query-local; a later default query retains binary storage ordering.
      const plain = await records.query({ index: "labels", fields: ["label"], limit: 3 });
      expect(plain.records.map(({ fields }) => fields.label)).toEqual(["Ticket 1", "Ticket 10", "a\0b"]);
      await checkTopLabels(records, labels);
    }
  } finally {
    await fixture.close();
  }
});
