import { expect, test } from "bun:test";
import { kanbanPageFields, tablePageFields } from "./renderer-page-fields";

test("table pages include hidden grouping fields but omit hidden bodies", () => {
  expect(
    tablePageFields([{ id: "title" }, { id: "status", hidden: true }, { id: "body" }], {
      hiddenColumns: ["body"],
      grouping: "status",
    }),
  ).toEqual(["title", "status"]);
});
test("board pages include displayed badge data and list short ids", () => {
  expect(
    kanbanPageFields([{ id: "people", display: { kind: "badge-list", itemsAttributeId: "peopleItems" } }], {
      displayProperties: ["people"],
      columnGrouping: "status",
      rowGrouping: "none",
      viewMode: "list",
    }),
  ).toEqual(["title", "people", "status", "id", "peopleItems"]);
});
