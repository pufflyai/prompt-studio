import { expect, test } from "bun:test";
import type { BoardField } from "@pstdio/sdk/api";
import { VIEW_FILTER_CONDITIONS, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { buildViewInput } from "./view-input";

const field = (id: string, kind: BoardField["kind"], options?: BoardField["options"]): BoardField => ({
  id,
  label: id,
  kind,
  conditions: [...VIEW_FILTER_CONDITIONS[kind]],
  filterable: true,
  groupable: kind === "enum",
  sortable: true,
  displayable: true,
  ...(options ? { options } : {}),
});
const fields = [
  field("tag", "enum", [
    { value: "a", label: "Bug" },
    { value: "b", label: "Duplicate" },
    { value: "c", label: "Duplicate" },
  ]),
  field("title", "string"),
  field("score", "number"),
  field("updated", "date"),
];
const board = { kind: "kanban" as const, fields };
const table = { kind: "dataTable" as const, fields };

test("turns repeated filters into rules joined with and, resolving option labels", () => {
  expect(
    buildViewInput(
      {
        filter: ["tag is-none-of Bug,b", "title contains data table", "score gte 70", "updated is-after today-7"],
        sort: ["score:desc", "title:asc"],
        mode: "list",
        show: "tag",
      },
      board,
    ),
  ).toEqual({
    filter: {
      conjunction: "and",
      rules: [
        { attributeId: "tag", condition: "is-none-of", value: ["a", "b"] },
        { attributeId: "title", condition: "contains", value: "data table" },
        { attributeId: "score", condition: "gte", value: 70 },
        { attributeId: "updated", condition: "is-after", value: "today-7" },
      ],
    },
    sorts: [
      { attributeId: "score", direction: "desc" },
      { attributeId: "title", direction: "asc" },
    ],
    settings: { viewMode: "list", displayProperties: ["tag"] },
  });
  expect(buildViewInput({ filter: ["title is-empty"] }, board).filter?.rules).toEqual([
    { attributeId: "title", condition: "is-empty" },
  ]);
});

test("refuses conditions, values, and labels the field does not accept", () => {
  expect(() => buildViewInput({ filter: ["score contains 7"] }, board)).toThrow(
    `Valid conditions: ${VIEW_FILTER_CONDITIONS.number.join(", ")}`,
  );
  expect(() => buildViewInput({ filter: ["score gt many"] }, board)).toThrow("needs a number");
  expect(() => buildViewInput({ filter: ["missing is x"] }, board)).toThrow("Valid IDs: tag, title, score, updated");
  expect(() => buildViewInput({ filter: ["tag is-any-of Duplicate"] }, board)).toThrow("b, c");
  expect(() => buildViewInput({ filter: ["tag is-any-of"] }, board)).toThrow("needs a value");
  expect(() => buildViewInput({ filter: ["tag"] }, board)).toThrow("<field> <condition> [value]");
  expect(() => buildViewInput({ sort: ["tag:down"] }, board)).toThrow("asc|desc");
});

test("clears filters and sorts, and takes a filter group as JSON", () => {
  expect(buildViewInput({ filter: ["none"], sort: ["none"] }, board)).toEqual({
    filter: { conjunction: "and", rules: [] },
    sorts: [],
  });
  const group: ViewFilterGroup = { conjunction: "or", rules: [{ attributeId: "score", condition: "gt", value: 1 }] };
  expect(buildViewInput({ "filter-json": JSON.stringify(group) }, board).filter).toEqual(group);
  expect(() => buildViewInput({ "filter-json": "{}", filter: ["score gt 1"] }, board)).toThrow("not both");
});

test("data table views take table display flags and refuse board flags", () => {
  expect(
    buildViewInput({ group: "tag", "row-numbers": "hide", "wrap-rows": "on", stats: "off", show: "score,tag" }, table),
  ).toEqual({
    settings: {
      grouping: "tag",
      rowNumbers: false,
      wrapRows: true,
      showStats: false,
      columnOrder: ["score", "tag", "title", "updated"],
      hiddenColumns: ["title", "updated"],
    },
  });
  expect(() => buildViewInput({ columns: "tag" }, table)).toThrow("--columns applies to board views only");
  expect(() => buildViewInput({ "row-numbers": "hide" }, board)).toThrow("--row-numbers applies to data table views");
});
