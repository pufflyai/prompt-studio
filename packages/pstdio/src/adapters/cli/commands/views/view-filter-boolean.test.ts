import { expect, test } from "bun:test";
import type { BoardField } from "@pstdio/sdk/api";
import { VIEW_FILTER_CONDITIONS } from "@pstdio/sdk/extensions";
import { buildFilter } from "./view-filter-input";

const fields: BoardField[] = [
  {
    id: "approved",
    label: "Approved",
    kind: "boolean",
    conditions: [...VIEW_FILTER_CONDITIONS.boolean],
    filterable: true,
    groupable: false,
    sortable: true,
    displayable: true,
  },
];
test("CLI boolean filters parse true and false without string coercion", () => {
  expect(buildFilter({ filter: ["approved is false", "approved is-not true"] }, fields)?.rules).toEqual([
    { attributeId: "approved", condition: "is", value: false },
    { attributeId: "approved", condition: "is-not", value: true },
  ]);
  expect(() => buildFilter({ filter: ["approved is Active"] }, fields)).toThrow("needs a boolean");
});
