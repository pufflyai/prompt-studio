import { describe, expect, test } from "bun:test";
import type { TreeListSection } from "./tree-list.types";
import { treeListDropIndicator } from "./tree-list-drop-indicator";
import { toGapDragId, toSectionDragId } from "./tree-list-reorder";

const sections: TreeListSection[] = [
  { id: "root", nodes: [{ id: "sessions", label: "Sessions" }] },
  { id: "examples", label: "Examples", nodes: [{ id: "scribble", label: "Scribble" }] },
  { id: "empty", label: "Empty", nodes: [] },
];

describe("tree list drop indicator", () => {
  test("highlights a group only when the row drops into it", () => {
    expect(treeListDropIndicator(sections, { kind: "node", id: "scribble", edge: "after" })).toEqual({
      lineId: "scribble",
      edge: "after",
      groupId: "examples",
    });
    expect(treeListDropIndicator(sections, { kind: "node", id: "sessions", edge: "before" })).toEqual({
      lineId: "sessions",
      edge: "before",
      groupId: undefined,
    });
  });
  test("draws the line in the gap behind a group", () => {
    expect(treeListDropIndicator(sections, { kind: "section", id: "examples", edge: "after" })).toEqual({
      lineId: toGapDragId("examples"),
      edge: "middle",
    });
  });
  test("draws a row joining a group after its last row, or on an empty group", () => {
    expect(treeListDropIndicator(sections, { kind: "section", id: "examples", edge: "inside" })).toMatchObject({
      lineId: "scribble",
      groupId: "examples",
    });
    expect(treeListDropIndicator(sections, { kind: "section", id: "empty", edge: "inside" })).toMatchObject({
      lineId: toSectionDragId("empty"),
      groupId: "empty",
    });
  });
  test("draws nothing for targets in another tree", () => {
    expect(treeListDropIndicator(sections, { kind: "node", id: "search", edge: "after" })).toBeNull();
  });
});
