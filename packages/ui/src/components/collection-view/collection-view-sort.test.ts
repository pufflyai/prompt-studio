import { describe, expect, test } from "bun:test";
import type { AttributeDescriptor, KanbanRendererRow } from "../kanban-renderer/types";
import { withTitleField } from "./collection-view-fields";
import { groupRowsByField } from "./collection-view-grouping";
import { findSearchRanges, searchRows } from "./collection-view-search";
import { sortRowsByView } from "./collection-view-sort";

const priority: AttributeDescriptor = {
  id: "priority",
  label: "Priority",
  sortable: true,
  type: {
    kind: "enum",
    options: [
      { value: "urgent", label: "Urgent" },
      { value: "high", label: "High" },
      { value: "low", label: "Low" },
    ],
  },
};
const fields = withTitleField([
  priority,
  { id: "updated", label: "Updated", type: { kind: "date" }, sortable: true },
  { id: "score", label: "Score", type: { kind: "number" }, sortable: true },
  { id: "tags", label: "Tags", type: { kind: "enum-multi", options: [] }, sortable: true },
  { id: "owner", label: "Owner", type: { kind: "string" }, groupable: true },
]);

const row = (id: string, attributes: Record<string, unknown>): KanbanRendererRow => ({
  id,
  title: `Row ${id}`,
  attributes,
});
const rows = [
  row("a", { priority: "low", updated: "2026-09-01", score: 10, owner: "sam" }),
  row("b", { priority: "high", updated: "2026-09-03", score: 2, owner: "alex" }),
  row("c", { priority: "high", updated: "2026-09-05" }),
  row("d", { priority: "urgent", updated: "2026-09-02", score: 7, owner: "alex" }),
];
const ids = (list: KanbanRendererRow[]) => list.map((entry) => entry.id);

describe("view sorts", () => {
  test("later sorts break ties of earlier ones", () => {
    const sorted = sortRowsByView(
      rows,
      [
        { attributeId: "priority", direction: "asc" },
        { attributeId: "updated", direction: "desc" },
      ],
      fields,
    );

    expect(ids(sorted)).toEqual(["d", "c", "b", "a"]);
  });

  test("rows without a value stay last in both directions", () => {
    expect(ids(sortRowsByView(rows, [{ attributeId: "score", direction: "asc" }], fields))).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
    expect(ids(sortRowsByView(rows, [{ attributeId: "score", direction: "desc" }], fields))).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  test("no sorts, unknown fields, and multi-value fields keep the incoming order", () => {
    expect(sortRowsByView(rows, [], fields)).toBe(rows);
    expect(sortRowsByView(rows, [{ attributeId: "tags", direction: "asc" }], fields)).toBe(rows);
    expect(ids(sortRowsByView(rows, [{ attributeId: "title", direction: "desc" }], fields))).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });
});

describe("grouping by a field", () => {
  test("option fields follow option order and empty values form the last group", () => {
    const groups = groupRowsByField([...rows, row("e", {})], priority);

    expect(groups.map((group) => [group.label, ids(group.rows)])).toEqual([
      ["Urgent", ["d"]],
      ["High", ["b", "c"]],
      ["Low", ["a"]],
      ["No priority", ["e"]],
    ]);
  });

  test("other fields go A to Z", () => {
    const groups = groupRowsByField(rows, fields.find((field) => field.id === "owner")!);

    expect(groups.map((group) => group.label)).toEqual(["alex", "sam", "No owner"]);
  });
});

describe("search", () => {
  test("narrows rows to the text they show and finds each match", () => {
    expect(ids(searchRows(rows, " ROW b ", (entry) => [entry.title]))).toEqual(["b"]);
    expect(searchRows(rows, "  ", () => [])).toBe(rows);
    expect(findSearchRanges("Filter pills read as filters", "filter")).toEqual([
      [0, 6],
      [21, 27],
    ]);
  });
});
