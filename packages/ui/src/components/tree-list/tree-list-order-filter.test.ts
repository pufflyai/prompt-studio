import { describe, expect, test } from "bun:test";
import type { TreeListSection } from "./tree-list.types";
import { applyTreeListOrder } from "./tree-list-order-filter";

const baseSections: TreeListSection[] = [
  {
    id: "alpha",
    label: "Alpha",
    nodes: [
      { id: "a.1", label: "A1" },
      { id: "a.2", label: "A2" },
    ],
  },
  { id: "beta", label: "Beta", nodes: [{ id: "b.1", label: "B1" }] },
  { id: "gamma", label: "Gamma", nodes: [{ id: "g.1", label: "G1" }] },
];

describe("applyTreeListOrder", () => {
  test("returns the same reference when order is empty", () => {
    expect(applyTreeListOrder(baseSections, [], {})).toBe(baseSections);
  });

  test("reorders sections by the saved order", () => {
    const result = applyTreeListOrder(baseSections, ["gamma", "alpha"], {});
    expect(result.map((section) => section.id)).toEqual(["gamma", "alpha", "beta"]);
  });

  test("appends sections not in the saved order in their declaration position", () => {
    const result = applyTreeListOrder(baseSections, ["beta"], {});
    expect(result.map((section) => section.id)).toEqual(["beta", "alpha", "gamma"]);
  });

  test("skips orphan IDs in the saved order", () => {
    const result = applyTreeListOrder(baseSections, ["deleted", "beta"], {});
    expect(result.map((section) => section.id)).toEqual(["beta", "alpha", "gamma"]);
  });

  test("reorders nodes per section, appending unknown ones in declaration order", () => {
    const result = applyTreeListOrder(baseSections, [], { alpha: ["a.2"] });
    const alpha = result.find((section) => section.id === "alpha");
    expect(alpha?.nodes.map((node) => node.id)).toEqual(["a.2", "a.1"]);
  });

  test("returns input ref when nothing in the order changes the result", () => {
    // sectionOrder identical to current order; node order matches existing.
    const noOpOrder = ["alpha", "beta", "gamma"];
    const noOpNodes = { alpha: ["a.1", "a.2"] };
    const result = applyTreeListOrder(baseSections, noOpOrder, noOpNodes);
    expect(result).toBe(baseSections);
  });
});
