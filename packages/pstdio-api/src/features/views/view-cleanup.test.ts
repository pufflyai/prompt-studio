import { expect, test } from "bun:test";
import type { BoardField } from "pstdio-api-contracts";
import { VIEW_FILTER_CONDITIONS } from "pstdio-api-contracts/extension-kernel";
import { cleanBoardView } from "./view-cleanup";

test("saved enum filters migrate to booleans before generic field cleanup", () => {
  const settings = { viewMode: "board" as const, columnGrouping: "none", rowGrouping: "none", displayProperties: [] };
  const fields: BoardField[] = [
    {
      id: "archived",
      label: "Archived",
      kind: "boolean",
      legacyValues: { active: false, archived: true },
      conditions: [...VIEW_FILTER_CONDITIONS.boolean],
      filterable: true,
      groupable: false,
      sortable: false,
      displayable: false,
    },
  ];
  const state = {
    settings,
    sorts: [],
    filter: {
      conjunction: "and" as const,
      rules: [{ attributeId: "archived", condition: "is-any-of" as const, value: ["active"] }],
    },
  };
  expect(cleanBoardView({ kind: "kanban", settings }, state, fields).filter).toEqual({
    conjunction: "and",
    rules: [{ attributeId: "archived", condition: "is", value: false }],
  });
});

test("status views keep stable IDs when choices become query-owned enums", () => {
  const settings = {
    viewMode: "board" as const,
    columnGrouping: "state",
    rowGrouping: "none",
    displayProperties: ["state"],
  };
  const view = {
    settings,
    sorts: [{ attributeId: "state", direction: "asc" as const }],
    filter: {
      conjunction: "and" as const,
      rules: [{ attributeId: "state", condition: "is-any-of" as const, value: ["todo", "gone"] }],
    },
  };
  const field: BoardField = {
    id: "state",
    label: "State",
    kind: "enum",
    conditions: [...VIEW_FILTER_CONDITIONS.enum],
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
    options: [
      { value: "todo", label: "Ready" },
      { value: "gone", label: "Gone" },
    ],
  };
  expect(cleanBoardView({ kind: "kanban", settings }, view, [field])).toEqual(view);
  field.options = [{ value: "todo", label: "Renamed again" }];
  expect(cleanBoardView({ kind: "kanban", settings }, view, [field])).toEqual({
    ...view,
    filter: { ...view.filter, rules: [{ ...view.filter.rules[0], value: ["todo"] }] },
  });
});
