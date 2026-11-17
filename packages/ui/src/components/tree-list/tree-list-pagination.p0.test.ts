import { expect, test } from "bun:test";
import { buildVirtualRows, getFocusableRows } from "./tree-list-model";
import { filterVisibleSections } from "./tree-list-visibility-filter";

test("continuation boundaries follow siblings and only exist in expanded collections", () => {
  const pagination = { loadMore() {} };
  const sections = [
    {
      id: "history",
      label: "History",
      pagination,
      nodes: [{ id: "workspace", label: "Workspace", pagination, children: [{ id: "session", label: "Session" }] }],
    },
  ];
  const rows = buildVirtualRows(sections, ["history"], ["workspace"]);
  expect(rows.map((row) => row.kind)).toEqual(["section-header", "node", "node", "continuation", "continuation"]);
  expect(getFocusableRows(rows).map((row) => row.key)).toEqual([
    "header:history",
    "history:workspace",
    "history:session",
  ]);
  expect(buildVirtualRows(sections, ["history"], []).map((row) => row.kind)).toEqual([
    "section-header",
    "node",
    "continuation",
  ]);
  expect(buildVirtualRows(sections, [], []).map((row) => row.kind)).toEqual(["section-header"]);
});

test("an empty page with a continuation stays reachable unless explicitly hidden", () => {
  const sections = [{ id: "history", nodes: [], pagination: { loadMore() {} } }];
  expect(filterVisibleSections(sections, {}, {})).toEqual(sections);
  expect(filterVisibleSections(sections, { history: "hidden" }, {})).toEqual([]);
});
