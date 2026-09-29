import { expect, test } from "bun:test";
import { pinnedOnlyNodeIds, withoutPinnedOnlyRows } from "./tree-pinned-only";

test("keeps pinned-only rows out of the body and drops sections they emptied", () => {
  const ids = pinnedOnlyNodeIds([
    { id: "project", nodes: [{ id: "tickets", label: "Tickets", pinnedOnly: true }] },
    { id: "level", nodes: [{ id: "note", label: "Note" }] },
  ]);
  const sections = withoutPinnedOnlyRows(
    [
      { id: "project", nodes: [{ id: "tickets", label: "Tickets" }] },
      { id: "level", nodes: [{ id: "note", label: "Note" }] },
      { id: "empty-level", nodes: [] },
    ],
    ids,
  );
  expect(sections.map((section) => [section.id, section.nodes.map((node) => node.id)])).toEqual([
    ["level", ["note"]],
    ["empty-level", []],
  ]);
});
