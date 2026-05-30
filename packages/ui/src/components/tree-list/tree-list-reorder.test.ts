import { describe, expect, test } from "bun:test";
import type { TreeListSection } from "./tree-list.types";
import { computeReorderResult, fromSectionDragId, isSectionDragId, toSectionDragId } from "./tree-list-reorder";

const sections: TreeListSection[] = [
  {
    id: "alpha",
    nodes: [
      { id: "a.1", label: "A1" },
      { id: "a.2", label: "A2" },
    ],
  },
  { id: "beta", nodes: [{ id: "b.1", label: "B1" }] },
];

describe("section drag id helpers", () => {
  test("round-trips through toSectionDragId / fromSectionDragId", () => {
    const id = toSectionDragId("alpha");
    expect(isSectionDragId(id)).toBe(true);
    expect(fromSectionDragId(id)).toBe("alpha");
  });
});

describe("computeReorderResult", () => {
  test("returns null when active and over are the same", () => {
    expect(computeReorderResult(sections, toSectionDragId("alpha"), toSectionDragId("alpha"))).toBeNull();
    expect(computeReorderResult(sections, "a.1", "a.1")).toBeNull();
  });

  test("emits a section reorder for two section drag ids", () => {
    const result = computeReorderResult(sections, toSectionDragId("beta"), toSectionDragId("alpha"));
    expect(result).toEqual({ kind: "section", nextSectionIds: ["beta", "alpha"] });
  });

  test("emits a node reorder for two node ids in the same section", () => {
    const result = computeReorderResult(sections, "a.2", "a.1");
    expect(result).toEqual({ kind: "node", sectionId: "alpha", nextNodeIds: ["a.2", "a.1"] });
  });

  test("returns null for cross-section node drag (no cross-section moves)", () => {
    expect(computeReorderResult(sections, "a.1", "b.1")).toBeNull();
  });

  test("returns null when active or over id is unknown", () => {
    expect(computeReorderResult(sections, "ghost", "a.1")).toBeNull();
    expect(computeReorderResult(sections, toSectionDragId("ghost"), toSectionDragId("alpha"))).toBeNull();
  });
});
