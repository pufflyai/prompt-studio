import { describe, expect, test } from "bun:test";
import type { TreeListSection } from "./tree-list.types";
import {
  buildTreeVisibilityMenuActions,
  filterVisibleSections,
  resolveVisibility,
} from "./tree-list-visibility-filter";

const sections: TreeListSection[] = [
  {
    id: "alpha",
    label: "Alpha",
    nodes: [
      { id: "alpha.1", label: "Alpha 1" },
      { id: "alpha.2", label: "Alpha 2", hiddenByDefault: true },
    ],
  },
  {
    id: "beta",
    label: "Beta",
    hiddenByDefault: true,
    nodes: [{ id: "beta.1", label: "Beta 1" }],
  },
];

describe("resolveVisibility", () => {
  test("respects user override over default", () => {
    expect(resolveVisibility("shown", true)).toBe("shown");
    expect(resolveVisibility("hidden", false)).toBe("hidden");
  });

  test("falls back to contribution default when no override", () => {
    expect(resolveVisibility(undefined, true)).toBe("hidden");
    expect(resolveVisibility(undefined, false)).toBe("shown");
    expect(resolveVisibility(undefined, undefined)).toBe("shown");
  });
});

describe("filterVisibleSections", () => {
  test("returns the same array reference when no overrides and no hidden defaults change anything", () => {
    const sectionsAllVisible: TreeListSection[] = [{ id: "a", label: "A", nodes: [{ id: "a.1", label: "A1" }] }];
    expect(filterVisibleSections(sectionsAllVisible, {}, {})).toBe(sectionsAllVisible);
  });

  test("drops sections that are hidden by default unless the user overrode them", () => {
    const result = filterVisibleSections(sections, {}, {});
    expect(result.map((section) => section.id)).toEqual(["alpha"]);
    expect(result[0].nodes.map((node) => node.id)).toEqual(["alpha.1"]);
  });

  test("user override of 'shown' un-hides a hiddenByDefault section", () => {
    const result = filterVisibleSections(sections, { beta: "shown" }, {});
    expect(result.map((section) => section.id)).toEqual(["alpha", "beta"]);
  });

  test("user override of 'hidden' hides a normally-visible section", () => {
    const result = filterVisibleSections(sections, { alpha: "hidden" }, {});
    expect(result.map((section) => section.id)).toEqual([]);
  });

  test("filters nested children recursively", () => {
    const nested: TreeListSection[] = [
      {
        id: "root",
        label: "Root",
        nodes: [
          {
            id: "parent",
            label: "Parent",
            children: [
              { id: "child-a", label: "A" },
              { id: "child-b", label: "B" },
            ],
          },
        ],
      },
    ];
    const result = filterVisibleSections(nested, {}, { "child-b": "hidden" });
    expect(result[0].nodes[0].children?.map((child) => child.id)).toEqual(["child-a"]);
  });
});

describe("buildTreeVisibilityMenuActions", () => {
  const noopActions = {
    onToggleSection: () => {},
    onToggleNode: () => {},
    onResetAll: () => {},
  };

  test("emits one action per section and per visible-section's nodes plus a reset action", () => {
    const actions = buildTreeVisibilityMenuActions(sections, {}, {}, noopActions, { checkmark: "✓" });
    const keys = actions.map((action) => action.key);
    // Alpha (section + alpha.1 + alpha.2), Beta (section only — hidden by default), reset
    expect(keys).toEqual(["section:alpha", "node:alpha.1", "node:alpha.2", "section:beta", "__reset-visibility"]);
  });

  test("includes a 'Reset order' entry when onResetOrder is provided", () => {
    const actions = buildTreeVisibilityMenuActions(
      sections,
      {},
      {},
      { ...noopActions, onResetOrder: () => {} },
      { checkmark: "✓" },
    );
    expect(actions[actions.length - 1].key).toBe("__reset-order");
  });

  test("shows checkmark only on effectively-visible entries", () => {
    const actions = buildTreeVisibilityMenuActions(sections, {}, {}, noopActions, { checkmark: "✓" });
    const findKey = (key: string) => actions.find((a) => a.key === key);

    expect(findKey("section:alpha")?.endContent).toBe("✓");
    expect(findKey("node:alpha.1")?.endContent).toBe("✓");
    expect(findKey("node:alpha.2")?.endContent).toBe(null); // hiddenByDefault
    expect(findKey("section:beta")?.endContent).toBe(null); // hiddenByDefault
  });

  test("renders canHide:false nodes as a disabled, checked row that cannot be toggled", () => {
    const locked: TreeListSection[] = [
      {
        id: "primary",
        label: "Primary",
        nodes: [
          { id: "search", label: "Search", canHide: false },
          { id: "tickets", label: "Tickets" },
        ],
      },
    ];
    const toggled: string[] = [];
    const actions = buildTreeVisibilityMenuActions(
      locked,
      {},
      {},
      { ...noopActions, onToggleNode: (id) => toggled.push(id) },
      { checkmark: "✓" },
    );

    const search = actions.find((action) => action.key === "node:search");
    expect(search?.isDisabled).toBe(true);
    expect(search?.endContent).toBe("✓");
    search?.onClick();
    expect(toggled).toEqual([]);

    const tickets = actions.find((action) => action.key === "node:tickets");
    expect(tickets?.isDisabled).toBeFalsy();
    tickets?.onClick();
    expect(toggled).toEqual(["tickets"]);
  });

  test("omits the toggle row for unlabeled structural sections but still lists their nodes", () => {
    const structural: TreeListSection[] = [
      { id: "group", nodes: [{ id: "search", label: "Search" }] },
      { id: "named", label: "Named", nodes: [{ id: "item", label: "Item" }] },
    ];
    const actions = buildTreeVisibilityMenuActions(structural, {}, {}, noopActions, { checkmark: "✓" });

    expect(actions.map((action) => action.key)).toEqual([
      "node:search",
      "section:named",
      "node:item",
      "__reset-visibility",
    ]);
  });
});
