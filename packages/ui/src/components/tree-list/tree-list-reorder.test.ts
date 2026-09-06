import { describe, expect, test } from "bun:test";
import type { TreeListSection } from "./tree-list.types";
import {
  canDropOnTreeListTarget,
  computeReorderResult,
  fromSectionDragId,
  isSectionDragId,
  type TreeListMove,
  toSectionDragId,
} from "./tree-list-reorder";

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
    expect(result).toEqual({ kind: "node", orders: { alpha: ["a.2", "a.1"] } });
  });

  test("moves a node between sections", () => {
    expect(computeReorderResult(sections, "a.1", "b.1")).toEqual({
      kind: "node",
      orders: { alpha: ["a.2"], beta: ["a.1", "b.1"] },
    });
  });

  test("uses one configurable policy for section and node moves", () => {
    const scopedSections: TreeListSection[] = [
      {
        ...sections[0]!,
        moveScope: "mode",
        nodes: sections[0]!.nodes.map((node) => ({ ...node, moveScope: "mode" })),
      },
      {
        ...sections[1]!,
        moveScope: "page",
        nodes: sections[1]!.nodes.map((node) => ({ ...node, moveScope: "page" })),
      },
    ];
    const moves: TreeListMove[] = [];
    const canMove = (move: TreeListMove) => {
      moves.push(move);
      return move.source.moveScope === move.destination.moveScope;
    };

    expect(computeReorderResult(scopedSections, "a.2", "a.1", canMove)).toEqual({
      kind: "node",
      orders: { alpha: ["a.2", "a.1"] },
    });
    expect(computeReorderResult(scopedSections, "a.1", "b.1", canMove)).toBeNull();
    expect(canDropOnTreeListTarget(scopedSections, "a.1", "b.1", canMove)).toBe(false);
    expect(canDropOnTreeListTarget(scopedSections, "a.2", "a.1", canMove)).toBe(true);
    expect(moves.map((move) => [move.source.moveScope, move.destination.moveScope])).toEqual([
      ["mode", "mode"],
      ["mode", "page"],
      ["mode", "page"],
      ["mode", "mode"],
    ]);
  });

  test("returns null when active or over id is unknown", () => {
    expect(computeReorderResult(sections, "ghost", "a.1")).toBeNull();
    expect(computeReorderResult(sections, toSectionDragId("ghost"), toSectionDragId("alpha"))).toBeNull();
  });

  test("keeps explicitly locked sections and nodes in place", () => {
    const constrainedSections: TreeListSection[] = [
      {
        id: "header",
        canReorder: false,
        nodes: [
          { id: "project", label: "Project", canReorder: false },
          { id: "search", label: "Search" },
        ],
      },
      { id: "main", nodes: [{ id: "tickets", label: "Tickets" }] },
    ];

    expect(computeReorderResult(constrainedSections, toSectionDragId("header"), toSectionDragId("main"))).toBeNull();
    expect(computeReorderResult(constrainedSections, toSectionDragId("main"), toSectionDragId("header"))).toBeNull();
    expect(computeReorderResult(constrainedSections, "project", "search")).toBeNull();
    expect(computeReorderResult(constrainedSections, "search", "project")).toBeNull();
  });
});
