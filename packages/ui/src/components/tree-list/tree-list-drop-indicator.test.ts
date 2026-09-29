import { describe, expect, test } from "bun:test";
import type { TreeListSection } from "./tree-list.types";
import { treeListDropIndicator } from "./tree-list-drop-indicator";
import { toSectionDragId } from "./tree-list-reorder";

const sections: TreeListSection[] = [
  { id: "nav", nodes: ["projects", "skills", "runs"].map((id) => ({ id, label: id })) },
  { id: "tools", nodes: [{ id: "lab", label: "Lab" }] },
];

describe("tree list drop indicator", () => {
  test("marks the slot the row lands in within its section", () => {
    expect(treeListDropIndicator(sections, "projects", "runs")).toEqual({ id: "runs", edge: "after" });
    expect(treeListDropIndicator(sections, "runs", "projects")).toEqual({ id: "projects", edge: "before" });
  });
  test("marks rows from another section or tree before the hovered row", () => {
    expect(treeListDropIndicator(sections, "lab", "skills")).toEqual({ id: "skills", edge: "before" });
    expect(treeListDropIndicator(sections, "search", "skills")).toEqual({ id: "skills", edge: "before" });
  });
  test("marks the end of a section a row is dropped on", () => {
    expect(treeListDropIndicator(sections, "projects", toSectionDragId("tools"))).toEqual({
      id: toSectionDragId("tools"),
      edge: "after",
    });
  });
  test("marks the slot a section lands in", () => {
    expect(treeListDropIndicator(sections, toSectionDragId("nav"), toSectionDragId("tools"))).toEqual({
      id: toSectionDragId("tools"),
      edge: "after",
    });
    expect(treeListDropIndicator(sections, toSectionDragId("tools"), toSectionDragId("nav"))).toEqual({
      id: toSectionDragId("nav"),
      edge: "before",
    });
  });
  test("shows nothing over the dragged item itself", () => {
    expect(treeListDropIndicator(sections, "skills", "skills")).toBeNull();
  });
});
