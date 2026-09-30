import { describe, expect, test } from "bun:test";
import type { TreeListSection } from "./tree-list.types";
import { computeDropResult, resolveDropTarget, type TreeListDropTarget } from "./tree-list-drop";
import { canDropOnTreeListTarget, type TreeListMove, toGapDragId, toSectionDragId } from "./tree-list-reorder";

const rows = (...ids: string[]) => ids.map((id) => ({ id, label: id }));
const sections: TreeListSection[] = [
  { id: "root", nodes: rows("sessions", "notes") },
  { id: "examples", label: "Examples", nodes: rows("scribble", "kiln") },
  { id: "lab", label: "Lab", nodes: rows("lab-page") },
];
const node = (id: string, edge: "before" | "after"): TreeListDropTarget => ({ kind: "node", id, edge });

describe("resolveDropTarget", () => {
  test("uses the pointer's half of the hovered row", () => {
    expect(resolveDropTarget("notes", "kiln", true)).toEqual(node("kiln", "before"));
    expect(resolveDropTarget("notes", "kiln", false)).toEqual(node("kiln", "after"));
  });
  test("treats a section's gap as behind it and its own area as inside it", () => {
    expect(resolveDropTarget("notes", toGapDragId("examples"), true, "lab")).toEqual({
      kind: "section",
      id: "examples",
      edge: "after",
      nextSectionId: "lab",
    });
    expect(resolveDropTarget("notes", toSectionDragId("examples"), true)).toEqual({
      kind: "section",
      id: "examples",
      edge: "inside",
    });
    expect(resolveDropTarget(toSectionDragId("lab"), toSectionDragId("root"), true)).toEqual({
      kind: "section",
      id: "root",
      edge: "before",
    });
  });
});

describe("computeDropResult", () => {
  test("drops behind the last row of a group or header", () => {
    expect(computeDropResult(sections, "sessions", node("kiln", "after"))).toEqual({
      kind: "node",
      orders: { root: ["notes"], examples: ["scribble", "kiln", "sessions"] },
    });
    expect(computeDropResult(sections, "sessions", node("notes", "after"))).toEqual({
      kind: "node",
      orders: { root: ["notes", "sessions"] },
    });
  });
  test("joins a group dropped on its header", () => {
    expect(computeDropResult(sections, "notes", { kind: "section", id: "lab", edge: "inside" })).toEqual({
      kind: "node",
      orders: { root: ["sessions"], lab: ["lab-page", "notes"] },
    });
  });
  test("drags a row out of a group into a new bare run behind it", () => {
    const behind = { kind: "section" as const, id: "examples", edge: "after" as const, nextSectionId: "lab" };
    expect(computeDropResult(sections, "scribble", behind, undefined, "loose-1")).toEqual({
      kind: "node",
      orders: { examples: ["kiln"], "loose-1": ["scribble"] },
      looseSection: {
        id: "loose-1",
        afterSectionId: "examples",
        nextSectionIds: ["root", "examples", "loose-1", "lab"],
      },
    });
  });
  test("joins the bare run that already follows a group, and ends a bare run dropped behind", () => {
    const bare = [...sections.slice(0, 2), { id: "more", nodes: rows("extra") }];
    expect(
      computeDropResult(bare, "scribble", { kind: "section", id: "examples", edge: "after", nextSectionId: "more" }),
    ).toEqual({ kind: "node", orders: { examples: ["kiln"], more: ["scribble", "extra"] } });
    expect(computeDropResult(sections, "kiln", { kind: "section", id: "root", edge: "after" })).toEqual({
      kind: "node",
      orders: { examples: ["scribble"], root: ["sessions", "notes", "kiln"] },
    });
  });
  test("moves sections before or after another section", () => {
    const lab = toSectionDragId("lab");
    expect(computeDropResult(sections, lab, { kind: "section", id: "root", edge: "before" })).toEqual({
      kind: "section",
      nextSectionIds: ["lab", "root", "examples"],
    });
    expect(computeDropResult(sections, lab, { kind: "section", id: "examples", edge: "after" })).toBeNull();
  });
  test("applies one move policy to rows and sections", () => {
    const scoped = sections.map((section, index) => ({
      ...section,
      moveScope: index === 2 ? "page" : "mode",
      nodes: section.nodes.map((row) => ({ ...row, moveScope: index === 2 ? "page" : "mode" })),
    }));
    const canMove = (move: TreeListMove) => move.source.moveScope === move.destination.moveScope;
    expect(computeDropResult(scoped, "notes", node("kiln", "before"), canMove)).not.toBeNull();
    expect(computeDropResult(scoped, "notes", node("lab-page", "before"), canMove)).toBeNull();
    expect(canDropOnTreeListTarget(scoped, "notes", toGapDragId("lab"), canMove)).toBe(false);
  });
  test("keeps locked rows and sections in place", () => {
    const locked: TreeListSection[] = [
      { id: "header", canReorder: false, nodes: [{ id: "search", label: "Search", canReorder: false }] },
      { id: "main", nodes: rows("tickets") },
    ];
    expect(computeDropResult(locked, "search", node("tickets", "after"))).toBeNull();
    expect(
      computeDropResult(locked, toSectionDragId("main"), { kind: "section", id: "header", edge: "before" }),
    ).toBeNull();
    expect(computeDropResult(locked, "ghost", node("tickets", "after"))).toBeNull();
  });
});
