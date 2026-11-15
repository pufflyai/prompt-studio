import { expect, test } from "bun:test";
import {
  kanbanPageFields,
  kanbanSearchFields,
  rendererPagePresentation,
  tablePageFields,
  tableSearchFields,
} from "./renderer-page-fields";

test("query presentation uses the same labels and empty groups as resolved native controls", () => {
  expect(
    rendererPagePresentation([
      { id: "state", label: "État", type: { kind: "enum", options: [{ value: "open", label: "Ouvert" }] } },
      { id: "title" },
    ]),
  ).toEqual({
    state: { emptyGroup: "No état", options: [{ value: "open", label: "Ouvert" }] },
    title: { emptyGroup: "No title" },
  });
});

test("table pages include hidden grouping fields but omit hidden bodies", () => {
  expect(
    tableSearchFields([{ id: "title" }, { id: "status", hidden: true }, { id: "body" }], { hiddenColumns: ["body"] }),
  ).toEqual(["title"]);
  expect(
    tablePageFields([{ id: "title" }, { id: "status", hidden: true }, { id: "body" }], {
      hiddenColumns: ["body"],
      grouping: "status",
    }),
  ).toEqual(["title", "status"]);
});
test("board pages include displayed badge data and list short ids", () => {
  expect(kanbanSearchFields({ displayProperties: ["people"], viewMode: "list" })).toEqual(["title", "people", "id"]);
  expect(
    kanbanPageFields([{ id: "people", display: { kind: "badge-list", itemsAttributeId: "peopleItems" } }], {
      displayProperties: ["people"],
      columnGrouping: "status",
      rowGrouping: "none",
      viewMode: "list",
    }),
  ).toEqual(["title", "people", "status", "id", "peopleItems"]);
});
