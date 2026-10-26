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

  test("moves nodes between sections when both saved memberships are present", () => {
    const result = applyTreeListOrder(baseSections, [], {
      alpha: ["a.2"],
      beta: ["a.1", "b.1"],
    });
    expect(result.find((section) => section.id === "alpha")?.nodes.map((node) => node.id)).toEqual(["a.2"]);
    expect(result.find((section) => section.id === "beta")?.nodes.map((node) => node.id)).toEqual(["a.1", "b.1"]);
  });

  test("returns input ref when nothing in the order changes the result", () => {
    // sectionOrder identical to current order; node order matches existing.
    const noOpOrder = ["alpha", "beta", "gamma"];
    const noOpNodes = { alpha: ["a.1", "a.2"] };
    const result = applyTreeListOrder(baseSections, noOpOrder, noOpNodes);
    expect(result).toBe(baseSections);
  });
});

test("keeps fixed sections and rows in their declared positions when restoring saved order", () => {
  const sections = [
    { id: "fixed", canReorder: false, nodes: [{ id: "fixed", label: "Fixed", canReorder: false }] },
    {
      id: "files",
      nodes: [
        { id: "pinned", label: "Pinned", canReorder: false },
        { id: "one", label: "One" },
        { id: "two", label: "Two" },
      ],
    },
  ];
  const result = applyTreeListOrder(sections, ["files"], { files: ["two", "one"] });
  expect(result.map((section) => section.id)).toEqual(["fixed", "files"]);
  expect(result[1].nodes.map((node) => node.id)).toEqual(["pinned", "two", "one"]);
});

test("shows a bare run users created behind a group until its last row leaves", () => {
  const sections = [
    { id: "examples", label: "Examples", nodes: [{ id: "scribble", label: "Scribble", moveScope: "mode" }] },
    { id: "lab", label: "Lab", nodes: [{ id: "lab-page", label: "Lab page" }] },
  ];
  const result = applyTreeListOrder(sections, ["examples", "loose-1", "lab"], {
    examples: [],
    "loose-1": ["scribble"],
  });
  expect(result.map((section) => [section.id, section.label, section.nodes.map((node) => node.id)])).toEqual([
    ["examples", "Examples", []],
    ["loose-1", undefined, ["scribble"]],
    ["lab", "Lab", ["lab-page"]],
  ]);
  expect(result[1]!.moveScope).toBe("mode");
  const emptied = applyTreeListOrder(sections, ["examples", "loose-1", "lab"], { "loose-1": ["gone"] });
  expect(emptied.map((section) => section.id)).toEqual(["examples", "lab"]);
});
