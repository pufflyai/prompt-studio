import { expect, test } from "bun:test";
import { filterVisibleSections, type TreeListSection } from "@pstdio/ui";
import { keepSectionsEmptiedByMoves } from "./tree-emptied-sections";

test("keeps a section users emptied by moving its rows, so rows can move back", () => {
  const source: TreeListSection[] = [
    { id: "header", nodes: [{ id: "search", label: "Search" }] },
    { id: "hidden", canHide: true, nodes: [{ id: "help", label: "Help" }] },
    { id: "contributed-empty", label: "Empty", nodes: [] },
  ];
  // After the user moved Search into the body and hid the "hidden" section.
  const ordered: TreeListSection[] = [
    { id: "header", nodes: [] },
    { id: "hidden", canHide: true, nodes: [{ id: "help", label: "Help" }] },
    { id: "contributed-empty", label: "Empty", nodes: [] },
  ];
  const overrides = { hidden: "hidden" as const };
  const visible = filterVisibleSections(ordered, overrides, {});
  expect(keepSectionsEmptiedByMoves(source, ordered, visible, overrides).map((section) => section.id)).toEqual([
    "header",
  ]);
});

test("never brings back outer-level sections whose rows are pinned-only", () => {
  const source: TreeListSection[] = [{ id: "project", nodes: [{ id: "tickets", label: "Tickets" }] }];
  const ordered: TreeListSection[] = [{ id: "project", nodes: [] }];
  expect(keepSectionsEmptiedByMoves(source, ordered, [], {}, new Set(["tickets"]))).toEqual([]);
});
