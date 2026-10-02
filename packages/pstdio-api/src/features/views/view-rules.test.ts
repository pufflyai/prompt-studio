import { expect, test } from "bun:test";
import type { BoardField } from "pstdio-api-contracts";
import { VIEW_FILTER_CONDITIONS, type ViewFilterGroup } from "pstdio-api-contracts/extension-kernel";
import { cleanBoardView } from "./view-cleanup";
import { validateBoardView } from "./view-rules";

const field = (id: string, kind: BoardField["kind"], extra: Partial<BoardField> = {}): BoardField => ({
  id,
  label: id,
  kind,
  conditions: [...VIEW_FILTER_CONDITIONS[kind]],
  filterable: true,
  groupable: false,
  sortable: true,
  displayable: true,
  ...extra,
});
const fields = [
  field("status", "enum", { groupable: true, options: [{ value: "todo", label: "To do" }] }),
  field("tags", "enum-multi", { options: [{ value: "bug", label: "Bug" }] }),
  field("score", "number"),
];
const board = {
  viewMode: "board" as const,
  columnGrouping: "status",
  rowGrouping: "none",
  displayProperties: ["status"],
};
const table = {
  grouping: "status",
  rowNumbers: true,
  wrapRows: false,
  showStats: false,
  hiddenColumns: [],
  columnOrder: [],
};
const and = (...rules: ViewFilterGroup["rules"]): ViewFilterGroup => ({ conjunction: "and", rules });
const draft = (filter: ViewFilterGroup, sorts = [] as { attributeId: string; direction: "asc" | "desc" }[]) => ({
  settings: board,
  filter,
  sorts,
});

test("cleans removed fields, options, and sorts using valid board defaults", () => {
  const result = cleanBoardView(
    { kind: "kanban", settings: board },
    {
      settings: { ...board, columnGrouping: "gone", displayProperties: ["gone", "status"] },
      filter: and(
        { attributeId: "status", condition: "is-any-of", value: ["todo", "deleted"] },
        { attributeId: "status", condition: "is-none-of", value: ["deleted"] },
        { attributeId: "missing", condition: "is", value: "anything" },
        { conjunction: "or", rules: [{ attributeId: "missing", condition: "is", value: "x" }] },
      ),
      sorts: [
        { attributeId: "gone", direction: "asc" },
        { attributeId: "score", direction: "desc" },
      ],
    },
    fields,
  );
  expect(result).toEqual({
    settings: board,
    filter: and({ attributeId: "status", condition: "is-any-of", value: ["todo"] }),
    sorts: [{ attributeId: "score", direction: "desc" }],
  });
});

test("cleanup maps option conditions between single and multi-value fields", () => {
  const result = cleanBoardView(
    { kind: "kanban", settings: board },
    {
      settings: board,
      filter: and(
        { attributeId: "tags", condition: "is-any-of", value: ["bug"] },
        { attributeId: "status", condition: "has-none-of", value: ["todo"] },
        { attributeId: "score", condition: "contains", value: "7" },
      ),
      sorts: [{ attributeId: "tags", direction: "asc" }],
    },
    fields,
  );
  expect(result.filter).toEqual(
    and(
      { attributeId: "tags", condition: "has-any-of", value: ["bug"] },
      { attributeId: "status", condition: "is-none-of", value: ["todo"] },
    ),
  );
  expect(result.sorts).toEqual([]);
});

test("refuses rules and sorts the board's fields do not accept, listing the valid choices", () => {
  const check = (filter: ViewFilterGroup, sorts?: Parameters<typeof draft>[1]) => () =>
    validateBoardView("kanban", draft(filter, sorts), fields);
  expect(check(and({ attributeId: "score", condition: "contains", value: "7" }))).toThrow(
    VIEW_FILTER_CONDITIONS.number.join(", "),
  );
  expect(check(and({ attributeId: "status", condition: "is-any-of", value: ["deleted"] }))).toThrow(
    'Invalid filter value "deleted" for "status". Valid values: todo',
  );
  expect(check(and({ attributeId: "missing", condition: "is", value: "x" }))).toThrow("status, tags, score");
  const tooDeep = {
    conjunction: "and",
    rules: [{ conjunction: "or", rules: [{ conjunction: "and", rules: [] }] }],
  } as unknown as ViewFilterGroup;
  expect(check(tooDeep)).toThrow("A nested group may hold rules only");
  expect(check(and(), [{ attributeId: "tags", direction: "asc" }])).toThrow("Valid IDs: status, score");
  expect(check(and({ attributeId: "score", condition: "gte", value: 70 }))).not.toThrow();
});

test("checks data table settings against the table's columns", () => {
  const check = (settings: object) => () =>
    validateBoardView("dataTable", { settings, filter: and(), sorts: [] }, fields);
  expect(check(table)).not.toThrow();
  expect(check({ ...table, grouping: "score" })).toThrow("Valid IDs: none, status");
  expect(check({ ...table, hiddenColumns: ["gone"] })).toThrow("Valid IDs: status, tags, score");
  expect(check({ ...table, viewMode: "list" })).toThrow("do not fit a data table view");
  expect(() => validateBoardView("kanban", draft(and()), fields)).not.toThrow();
  expect(() => validateBoardView("kanban", { ...draft(and()), settings: table }, fields)).toThrow(
    "do not fit a board view",
  );
});
