import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("global scalar column statistics count beyond a page and return bounded summaries in DB and memory", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const native = createDocumentStorageDBService(fixture.db).open({
      owner: { workbenchId: fixture.projectAId, extensionId: "statistics" },
    }).records;
    for (const records of [native, createMemoryStorage().records]) {
      await records.defineIndexes([
        {
          name: "statistics",
          fields: {
            label: { path: ["label"], type: "string" },
            number: { path: ["number"], type: "number" },
            region: { path: ["region"], type: "string" },
            active: { path: ["active"], type: "boolean" },
          },
        },
      ]);
      for (let start = 0; start < 603; start += 100) {
        await records.commit({
          operationId: `seed-${start}`,
          edits: Array.from({ length: Math.min(100, 603 - start) }, (_, offset) => ({
            recordId: String(start + offset).padStart(4, "0"),
            replace: {
              label: `Label ${start + offset}`,
              number: (start + offset) % 11,
              region: ["Europe", "APAC", "Europe", "LATAM", "APAC", "North America"][(start + offset) % 6],
              active: start + offset < 600,
              body: "Not read".repeat(1000),
            },
          })),
        });
      }
      const result = await records.aggregate({
        index: "statistics",
        where: { field: "active", op: "eq", value: true },
        statistics: {
          distinct: { field: "label", type: "unique" },
          distribution: { field: "number", type: "histogram", bins: 5 },
          regions: { field: "region", type: "top-values", limit: 2, locale: "en-US" },
        },
      });
      expect(result.count).toBe(600);
      expect(result.groups).toEqual([]);
      expect(result.statistics?.distinct).toEqual({ type: "unique", count: 600 });
      expect(result.statistics?.regions).toEqual({
        type: "top-values",
        values: [
          { label: "APAC", count: 200, percentage: 33 },
          { label: "Europe", count: 200, percentage: 33 },
          { label: "Other", count: 200, percentage: 33 },
        ],
      });
      expect(result.statistics?.distribution.type).toBe("histogram");
      const histogram = result.statistics!.distribution;
      if (histogram.type !== "histogram") throw new Error("Missing histogram");
      expect(histogram.histogram?.bins.map(({ count }) => count)).toEqual([110, 110, 110, 108, 162]);
      expect(histogram.histogram).toMatchObject({ min: 0, max: 10 });
      const empty = await records.aggregate({
        index: "statistics",
        where: { field: "number", op: "gt", value: 100 },
        statistics: {
          none: { field: "number", type: "histogram" },
          unique: { field: "label", type: "unique" },
          top: { field: "region", type: "top-values" },
        },
      });
      expect(empty.statistics).toEqual({
        none: { type: "histogram", histogram: null },
        unique: { type: "unique", count: 0 },
        top: { type: "top-values", values: [] },
      });
      for (const [min, max] of [
        [-1e308, 1e308],
        [0, Number.MIN_VALUE],
      ]) {
        await records.commit({
          operationId: `range-${max}`,
          edits: [
            { recordId: "low", replace: { number: min } },
            { recordId: "high", replace: { number: max } },
          ],
        });
        const result = await records.aggregate({
          index: "statistics",
          where: { field: "label", op: "missing" },
          statistics: { range: { type: "histogram", field: "number", bins: 10 } },
        });
        const range = result.statistics!.range;
        if (range.type !== "histogram" || !range.histogram) throw new Error("Missing finite histogram");
        expect(range.histogram.bins.map(({ count }) => count)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
        expect(range.histogram.bins.every(({ start, end }) => Number.isFinite(start) && Number.isFinite(end))).toBe(
          true,
        );
      }
      await records.commit({
        operationId: "fraction",
        edits: [
          { recordId: "low", replace: { number: 0 } },
          { recordId: "high", replace: { number: 1 } },
          { recordId: "middle", replace: { number: 0.3 } },
        ],
      });
      const fractional = await records.aggregate({
        index: "statistics",
        where: { field: "label", op: "missing" },
        statistics: { fraction: { type: "histogram", field: "number", bins: 10 } },
      });
      const fraction = fractional.statistics!.fraction;
      if (fraction.type !== "histogram" || !fraction.histogram) throw new Error("Missing fractional histogram");
      expect(fraction.histogram.bins.map(({ count }) => count)).toEqual([1, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
      expect(fraction.histogram.bins[3].start).toBe(0.3);
    }
  } finally {
    await fixture.close();
  }
});
