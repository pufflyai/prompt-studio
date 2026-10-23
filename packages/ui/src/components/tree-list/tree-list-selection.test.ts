import { expect, test } from "bun:test";
import type { TreeListSection } from "./tree-list.types";
import { selectTreeListNodes, treeListSiblingMove } from "./tree-list-selection";

const sections: TreeListSection[] = [
  {
    id: "layers",
    nodes: [
      { id: "title", label: "Title" },
      {
        id: "group",
        label: "Group",
        children: [
          { id: "wave", label: "Wave", canDrag: true },
          { id: "foam", label: "Foam", canDrag: true },
        ],
      },
      { id: "missing", label: "Missing", disabled: true },
      { id: "paper", label: "Paper", canDrag: false },
    ],
  },
];

test("controlled selection replaces, toggles, and ranges over enabled visible rows", () => {
  const ids = ["title", "group", "wave", "foam", "paper"];
  expect(selectTreeListNodes(ids, ["wave"], "title", "wave", {})).toEqual(["title"]);
  expect(selectTreeListNodes(ids, ["wave"], "title", "wave", { metaKey: true })).toEqual(["wave", "title"]);
  expect(selectTreeListNodes(ids, ["wave"], "wave", "wave", { ctrlKey: true })).toEqual([]);
  expect(selectTreeListNodes(ids, ["wave"], "title", "wave", { shiftKey: true })).toEqual(["title", "group", "wave"]);
  expect(selectTreeListNodes(ids, ["wave"], "paper", "collapsed-child", { shiftKey: true })).toEqual(["paper"]);
});

test("keyboard moves use siblings, preserve hierarchy, and respect move permissions", () => {
  expect(treeListSiblingMove(sections, "foam", -1)).toEqual({ source: "foam", target: "wave", position: "before" });
  expect(treeListSiblingMove(sections, "wave", 1)).toEqual({ source: "wave", target: "foam", position: "after" });
  expect(treeListSiblingMove(sections, "wave", -1)).toBeUndefined();
  expect(treeListSiblingMove(sections, "paper", -1)).toBeUndefined();
  expect(treeListSiblingMove(sections, "missing", -1)).toBeUndefined();
});

test("keyboard targets sit outside the selected sibling block", () => {
  const movable: TreeListSection[] = [
    { id: "layers", nodes: ["a", "b", "c", "d"].map((id) => ({ id, label: id, canDrag: true })) },
  ];
  expect(treeListSiblingMove(movable, "b", 1, ["b", "c"])).toEqual({ source: "b", target: "d", position: "after" });
  expect(treeListSiblingMove(movable, "c", -1, ["b", "c"])).toEqual({ source: "c", target: "a", position: "before" });
});
