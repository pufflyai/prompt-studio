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
  field("parent", "string"),
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

test("cleanup maps option conditions, preserves exact lists, and keeps rules that stopped fitting", () => {
  const result = cleanBoardView(
    { kind: "kanban", settings: board },
    {
      settings: board,
      filter: and(
        { attributeId: "tags", condition: "is-any-of", value: ["bug"] },
        { attributeId: "status", condition: "has-none-of", value: ["todo"] },
        { attributeId: "parent", condition: "is-any-of", value: ["PS-1", "PS-2"] },
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
      { attributeId: "parent", condition: "is-any-of", value: ["PS-1", "PS-2"] },
      { attributeId: "score", condition: "contains", value: "7" },
    ),
  );
  expect(result.sorts).toEqual([{ attributeId: "tags", direction: "asc" }]);
});

test("refuses rules and sorts the board's fields do not accept, listing the valid choices", () => {
  const check = (filter: ViewFilterGroup, sorts?: Parameters<typeof draft>[1]) => () =>
    validateBoardView("kanban", draft(filter, sorts), fields, { filter, sorts });
  expect(check(and({ attributeId: "score", condition: "contains", value: "7" }))).toThrow(
    VIEW_FILTER_CONDITIONS.number.join(", "),
  );
  expect(check(and({ attributeId: "status", condition: "is-any-of", value: ["deleted"] }))).toThrow(
    'Invalid filter value "deleted" for "status". Valid values: todo',
  );
  expect(check(and({ attributeId: "missing", condition: "is", value: "x" }))).toThrow("status, tags, score, parent");
  expect(check(and(), [{ attributeId: "tags", direction: "asc" }])).toThrow("Valid IDs: status, score, parent");
  expect(check(and({ attributeId: "score", condition: "gte", value: 70 }))).not.toThrow();
});

test("does not check stored rules again when a request changes something else", () => {
  const stored = and({ attributeId: "score", condition: "contains", value: "7" });
  expect(() => validateBoardView("kanban", draft(stored), fields, {})).not.toThrow();
  expect(() => validateBoardView("kanban", draft(stored), fields, { filter: stored })).toThrow("does not accept");
});

test("checks data table settings against the table's columns", () => {
  const check = (settings: object) => () =>
    validateBoardView("dataTable", { settings, filter: and(), sorts: [] }, fields, {});
  expect(check(table)).not.toThrow();
  expect(check({ ...table, grouping: "score" })).toThrow("Valid IDs: none, status");
  expect(check({ ...table, hiddenColumns: ["gone"] })).toThrow("Valid IDs: status, tags, score, parent");
  expect(check({ ...table, viewMode: "list" })).toThrow("do not fit a data table view");
  expect(() => validateBoardView("kanban", draft(and()), fields, {})).not.toThrow();
  expect(() => validateBoardView("kanban", { ...draft(and()), settings: table }, fields, {})).toThrow(
    "do not fit a board view",
  );
});

test("keeps one saved ordering when fields are unavailable without dropping unknown data", () => {
  const stored = {
    settings: board,
    filter: and({ attributeId: "missing", condition: "is", value: "keep" }),
    sorts: [
      { attributeId: "missing", direction: "asc" as const },
      { attributeId: "score", direction: "desc" as const },
    ],
  };
  for (const unavailable of [undefined, []]) {
    expect(cleanBoardView({ kind: "kanban", settings: board }, stored, unavailable)).toEqual({
      ...stored,
      sorts: [stored.sorts[0]],
    });
  }
});

test("retained saved ordering is single on unrelated edits while explicit multi-sort writes fail", () => {
  const stored = draft(and(), [
    { attributeId: "status", direction: "asc" },
    { attributeId: "score", direction: "desc" },
  ]);
  expect(validateBoardView("kanban", stored, fields, {}).sorts).toEqual([stored.sorts[0]!]);
  expect(() => validateBoardView("kanban", stored, fields, { sorts: stored.sorts })).toThrow("only one sort");
});

test("resource list views accept any number of sub-groupings, normalized like the list shows them", () => {
  const groupFields = [
    ...fields,
    field("channel", "enum", { groupable: true, options: [{ value: "web", label: "Web" }] }),
    field("severity", "enum", { groupable: true, options: [{ value: "high", label: "High" }] }),
  ];
  const list = { ...board, viewMode: "list" as const, subGroupings: ["channel", "severity"], showChildren: true };
  const sent = { filter: undefined, sorts: undefined };
  const validate = (settings: object, kind: "resourceList" | "kanban" = "resourceList") =>
    validateBoardView(kind, { ...draft(and()), settings: settings as typeof list }, groupFields, sent);
  expect(validate(list).settings).toMatchObject({ columnGrouping: "status", subGroupings: ["channel", "severity"] });
  // A grouping change keeps the view valid: repeated or orphaned levels drop out instead of failing.
  expect(validate({ ...list, columnGrouping: "channel" }).settings).toMatchObject({ subGroupings: ["severity"] });
  expect(validate({ ...list, columnGrouping: "none" }).settings).toMatchObject({ subGroupings: [] });
  expect(validate({ ...list, subGroupings: ["channel", "channel"] }).settings).toMatchObject({
    subGroupings: ["channel"],
  });
  expect(() => validate({ ...list, viewMode: "board" })).toThrow("Resource lists require list display");
  expect(() => validate({ ...list, rowGrouping: "channel" })).toThrow("use subGroupings");
  expect(() => validate({ ...list, subGroupings: ["score"] })).toThrow('Invalid groupable field "score"');
  expect(() => validate({ ...board, subGroupings: ["channel"] }, "kanban")).toThrow("resource lists only");
});

test("cleanup drops sub-groupings that no longer fit the list", () => {
  const list = { ...board, viewMode: "list" as const, columnGrouping: "status", subGroupings: ["gone", "status"] };
  const result = cleanBoardView(
    { kind: "resourceList", settings: { ...board, viewMode: "list" } },
    { settings: list, filter: and(), sorts: [] },
    fields,
  );
  expect(result.settings).toMatchObject({ columnGrouping: "status", subGroupings: [] });
});
