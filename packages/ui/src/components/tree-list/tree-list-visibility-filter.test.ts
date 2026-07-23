import { describe, expect, test } from "bun:test";
import type { TreeListNode, TreeListSection } from "./tree-list.types";
import {
  buildTreeVisibilityMenuActions,
  filterVisibleNodes,
  filterVisibleSections,
  resolveVisibility,
} from "./tree-list-visibility-filter";

const sections: TreeListSection[] = [
  {
    id: "alpha",
    label: "Alpha",
    canHide: true,
    nodes: [
      { id: "alpha.1", label: "Alpha 1" },
      { id: "alpha.2", label: "Alpha 2", hiddenByDefault: true },
    ],
  },
  {
    id: "beta",
    label: "Beta",
    canHide: true,
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

describe("filterVisibleNodes", () => {
  const headerNodes: TreeListNode[] = [
    { id: "search", label: "Search", canHide: true },
    { id: "new-session", label: "New session", canHide: true },
  ];

  test("drops header/footer rows hidden by user override", () => {
    expect(filterVisibleNodes(headerNodes, { search: "hidden" }).map((node) => node.id)).toEqual(["new-session"]);
  });

  test("returns the same array reference when nothing is hidden", () => {
    expect(filterVisibleNodes(headerNodes, {})).toBe(headerNodes);
  });
});

describe("buildTreeVisibilityMenuActions", () => {
  const noopActions = {
    onToggleSection: () => {},
    onToggleNode: () => {},
    onResetAll: () => {},
  };
  const options = { visibleIcon: "eye", hiddenIcon: "eye-off" };

  test("lists header rows, body categories, and footer rows that opt in via canHide", () => {
    const actions = buildTreeVisibilityMenuActions(
      {
        headerNodes: [{ id: "search", label: "Search", canHide: true }],
        sections,
        footerNodes: [{ id: "help", label: "Help", canHide: true }],
      },
      {},
      {},
      noopActions,
      options,
    );

    expect(actions.map((action) => action.key)).toEqual([
      "node:search",
      "section:alpha",
      // alpha.2 is hiddenByDefault, so it opts in (listed eye-off) and stays restorable.
      "node:alpha.2",
      "section:beta",
      "node:help",
      "__reset-visibility",
    ]);
    expect(actions.find((action) => action.key === "section:alpha")?.separatorBefore).toBe(true);
    expect(actions.find((action) => action.key === "node:help")?.separatorBefore).toBe(true);
  });

  test("omits items that do not opt in — leaf sub-items are never hideable", () => {
    const actions = buildTreeVisibilityMenuActions(
      {
        headerNodes: [{ id: "fixed", label: "Fixed" }],
        sections: [
          {
            id: "files",
            label: "Files",
            canHide: true,
            nodes: [
              { id: "a.md", label: "a.md" },
              { id: "b.md", label: "b.md" },
            ],
          },
        ],
      },
      {},
      {},
      noopActions,
      options,
    );

    // Only the Files category — not its files, and not the non-opted-in header row.
    expect(actions.map((action) => action.key)).toEqual(["section:files", "__reset-visibility"]);
  });

  test("returns no menu actions when no items can be hidden", () => {
    const actions = buildTreeVisibilityMenuActions(
      {
        headerNodes: [{ id: "fixed", label: "Fixed" }],
        sections: [
          {
            id: "files",
            label: "Files",
            nodes: [
              { id: "a.md", label: "a.md" },
              { id: "b.md", label: "b.md" },
            ],
          },
        ],
        footerNodes: [{ id: "status", label: "Status" }],
      },
      {},
      {},
      noopActions,
      options,
    );

    expect(actions).toEqual([]);
  });

  test("lists top-level body rows that opt in (e.g. a nav entry) but not their leaf children", () => {
    const actions = buildTreeVisibilityMenuActions(
      {
        sections: [
          {
            id: "extension-data-renderers",
            // Unlabeled structural section: not a toggle target itself, but its top-level rows can opt in.
            nodes: [
              { id: "tickets", label: "Tickets", canHide: true, children: [{ id: "ticket-1", label: "PS-1" }] },
              { id: "planner", label: "Planner" },
            ],
          },
        ],
      },
      {},
      {},
      noopActions,
      options,
    );

    // The opted-in "Tickets" row is listed; "Planner" (no opt-in) and the leaf child are not.
    expect(actions.map((action) => action.key)).toEqual(["node:tickets", "__reset-visibility"]);
  });

  test("shows the eye on visible entries and eye-off on hidden entries", () => {
    const actions = buildTreeVisibilityMenuActions({ sections }, {}, {}, noopActions, options);
    const findKey = (key: string) => actions.find((a) => a.key === key);

    expect(findKey("section:alpha")?.endContent).toBe("eye");
    expect(findKey("section:beta")?.endContent).toBe("eye-off"); // hiddenByDefault
  });

  test("toggles header and footer rows through the node handler", () => {
    const toggled: string[] = [];
    const actions = buildTreeVisibilityMenuActions(
      {
        headerNodes: [{ id: "search", label: "Search", canHide: true }],
        sections: [],
        footerNodes: [{ id: "help", label: "Help", canHide: true }],
      },
      {},
      {},
      { ...noopActions, onToggleNode: (id) => toggled.push(id) },
      options,
    );

    actions.find((action) => action.key === "node:search")?.onClick();
    actions.find((action) => action.key === "node:help")?.onClick();
    expect(toggled).toEqual(["search", "help"]);
  });
});
