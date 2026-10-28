import { strict as assert } from "node:assert";
import {
  compareRows,
  createRow,
  matches,
  type Selection,
  scaleScopePredicate,
  scaleSelectionPredicate,
  scaleViewFields,
  type Workload,
} from "storage-scale-fixture";
import type { createDocumentStorageDBService } from "./document-storage";

export const readOperations = ["view", "second-page", "point", "aggregate"] as const;
export type ReadOperation = (typeof readOperations)[number];

// Oracles come from the generator, never from the storage being measured.
const expectedPage = (kind: Workload, owner: number, count: number, selection: Selection, page: number) =>
  Array.from({ length: count }, (_, ordinal) => ({ ordinal }))
    .filter((row) => matches(row, selection, count))
    .map(({ ordinal }) => createRow(kind, owner, ordinal, 3))
    .sort(compareRows)
    .slice(page * 100, (page + 1) * 100)
    .map((row) => row.id);

/** The requests a table or board makes for one owner, each checked against the generator. */
export const createViewReader = (
  records: ReturnType<ReturnType<typeof createDocumentStorageDBService>["open"]>["records"],
  kind: Workload,
  owner: number,
  count: number,
) => {
  const focus = expectedPage(kind, owner, count, "focus", 0);
  const second = expectedPage(kind, owner, count, "pages", 1);
  const focusCount = scaleSelectionPredicate(count, "focus").value.filter((ordinal) => ordinal < count).length;
  const counts = async (selection: Selection) => {
    const index = "scale-rows";
    const selected = await records.aggregate({
      index,
      where: scaleScopePredicate(false, scaleSelectionPredicate(count, selection)),
    });
    // A view without a filter asks for every live record, which the owner's stored count answers.
    const total = await records.aggregate({ index });
    assert.equal(selected.revision, total.revision, "Counts changed while reading them");
    assert.equal(total.count, count);
    return { selected: selected.count, total: total.count };
  };
  const page = async (selection: Selection, position: { offset: number } | { cursor: string }) => {
    const result = await records.query({
      index: "scale-rows",
      where: scaleScopePredicate(false, scaleSelectionPredicate(count, selection)),
      fields: scaleViewFields,
      limit: 100,
      ...position,
    });
    // A collection page always carries its counts; measure the request the renderer makes.
    return { ...result, counts: await counts(selection) };
  };
  return {
    run: async (operation: ReadOperation, cursor?: string) => {
      if (operation === "view") {
        const result = await page("focus", { offset: 0 });
        assert.deepEqual(
          result.records.map((record) => record.fields.id),
          focus,
        );
        assert.equal(result.counts.selected, focusCount);
        return { returned: result.records.length };
      }
      if (operation === "second-page") {
        const result = await page("pages", cursor ? { cursor } : { offset: 100 });
        assert.deepEqual(
          result.records.map((record) => record.fields.id),
          second,
        );
        return { returned: result.records.length, navigation: cursor ? "cursor" : "offset" };
      }
      if (operation === "point") {
        const expected = createRow(kind, owner, Math.floor(count / 2), 3);
        const [record] = await records.readMany([expected.id]);
        assert.deepEqual(record.value, expected);
        return { returned: 1 };
      }
      assert.equal((await counts("focus")).selected, focusCount);
      return { returned: 0 };
    },
    secondPageCursor: async () => {
      const first = await records.query({
        index: "scale-rows",
        where: scaleScopePredicate(false, scaleSelectionPredicate(count, "pages")),
        fields: scaleViewFields,
        limit: 100,
      });
      assert(first.cursor, "The broader selection must have a second page");
      return first.cursor;
    },
  };
};
