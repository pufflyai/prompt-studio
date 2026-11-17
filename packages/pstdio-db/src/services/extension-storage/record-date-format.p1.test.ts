import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { fingerprint, type Json, type StorageDateFormat, type StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("viewer date text and calendar predicates run before page selection and stay current after writes", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "calendar" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      const indexes = [{ name: "dates", fields: { date: { path: ["date"], type: "string" as const } } }];
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "a", replace: { date: "2026-11-14T01:00:00Z", body: "large body".repeat(1000) } },
          { recordId: "b", replace: { date: "2026-11-14T10:00:00Z" } },
        ],
      });
      await records.defineIndexes(indexes);
      const formats = {
        calendar: { field: "date", locale: "de-DE", timeZone: "America/New_York", part: "day" },
        text: { field: "date", locale: "de-DE", timeZone: "America/New_York", part: "text" },
      };
      const query = {
        index: "dates",
        formats,
        fields: ["text"],
        where: { field: "calendar", op: "eq", value: 20261114 },
        limit: 1,
      };
      expect((await records.query(query as never)).records.map(({ fields }) => fields.text)).toEqual(["14.11.2026"]);
      await records.defineIndexes(indexes);
      expect(
        (
          await records.aggregate({
            index: "dates",
            formats,
            where: { field: "text", op: "textContains", value: "13.11" },
          } as never)
        ).count,
      ).toBe(1);
      await records.commit({
        operationId: "edit",
        edits: [{ recordId: "a", set: { "/date": "2026-11-14T12:00:00Z" } }],
      });
      expect(
        (
          await records.aggregate({
            index: "dates",
            formats,
            where: { field: "calendar", op: "eq", value: 20261114 },
          } as never)
        ).count,
      ).toBe(2);
    }
  } finally {
    await f.close();
  }
});

test("active root and related date formats survive eviction of older viewer caches", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const records = createDocumentStorageDBService(fixture.db).open({
      owner: { workbenchId: fixture.projectAId, extensionId: "date-cache" },
    }).records;
    const index: StorageRecordIndex = { name: "dates", fields: { date: { path: ["date"], type: "string" } } };
    await records.defineIndexes([index, { ...index, name: "related-dates" }]);
    await records.commit({ operationId: "seed", edits: [{ recordId: "a", replace: { date: "2026-11-14" } }] });
    const formats = (
      await Promise.all(
        Array.from({ length: 129 }, async (_, i) => {
          const format: StorageDateFormat = {
            field: "date",
            locale: `en-x-l${String(i).padStart(3, "0")}`,
            timeZone: "UTC",
            part: "day",
          };
          return { format, hash: await fingerprint(format as unknown as Json) };
        }),
      )
    ).sort((a, b) => (a.hash < b.hash ? -1 : 1));
    for (let start = 0; start < 128; start += 32)
      await records.query({
        index: "dates",
        fields: [],
        limit: 1,
        formats: Object.fromEntries(formats.slice(start, start + 32).map(({ format }, i) => [`date${i}`, format])),
      });
    const result = await records.query({
      index: "dates",
      fields: ["old", "new"],
      limit: 1,
      formats: { old: formats[0].format, new: formats[128].format },
    });
    expect(result.records[0].fields).toEqual({ old: 20261114, new: 20261114 });
    const related = await records.query({
      index: "dates",
      fields: ["old"],
      limit: 1,
      formats: { old: formats[0].format },
      related: { "related-dates": { formats: { fresh: formats[128].format } } },
      where: {
        exists: {
          index: "related-dates",
          on: [{ sourceField: "date", relatedField: "date" }],
          where: { field: "fresh", op: "eq", value: 20261114 },
        },
      },
    });
    expect(related.records[0].fields.old).toBe(20261114);
  } finally {
    await fixture.close();
  }
});
