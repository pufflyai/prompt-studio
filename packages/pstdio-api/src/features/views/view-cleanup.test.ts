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
      rules: [
        {
          conjunction: "or" as const,
          rules: [{ attributeId: "archived", condition: "is-any-of" as const, value: ["active"] }],
        },
      ],
    },
  };
  expect(cleanBoardView({ kind: "kanban", settings }, state, fields).filter).toEqual({
    conjunction: "and",
    rules: [{ conjunction: "or", rules: [{ attributeId: "archived", condition: "is", value: false }] }],
  });
});
