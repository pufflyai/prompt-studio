import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../theme";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";
import { buildVirtualRows, getFocusableRows, resolveTreeListKeyboardNavigation } from "./tree-list-model";

test("noncollapsible groups show their children before the collection continuation", () => {
  const sections: TreeListSection[] = [
    {
      id: "resources",
      pagination: { loadMore() {} },
      nodes: [
        {
          id: "custom",
          label: "Custom resources",
          collapsible: false,
          children: [
            { id: "first", label: "First resource" },
            { id: "second", label: "Second resource" },
          ],
        },
      ],
    },
  ];
  const rows = buildVirtualRows(sections, [], []);
  expect(rows.filter((row) => row.kind === "node").map((row) => row.node.id)).toEqual(["first", "second"]);
  expect(
    resolveTreeListKeyboardNavigation({ rows, focusedRowId: undefined, expandedNodeIds: [], key: "Home" }),
  ).toMatchObject({ type: "focus", rowId: "first" });
  expect(rows.at(-1)?.kind).toBe("continuation");
  expect(rows[0]?.kind).toBe("group-header");
  expect(getFocusableRows(rows).map((row) => row.key)).toEqual(["resources:first", "resources:second"]);
  expect(rows[1]).toMatchObject({ level: 1, visualLevel: 0, parentNodeId: "custom" });
  expect(
    resolveTreeListKeyboardNavigation({ rows, focusedRowId: "first", expandedNodeIds: [], key: "ArrowLeft" }),
  ).toBeNull();
  const markup = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <TreeList sections={sections} />
    </ChakraProvider>,
  );
  expect(markup.includes("First resource")).toBe(true);
  expect(markup.includes("Second resource")).toBe(true);
});

test("resource groups preserve nested folder navigation and navigable fixed resources", () => {
  const rows = buildVirtualRows(
    [
      {
        id: "related",
        nodes: [
          {
            id: "notes",
            label: "Notes",
            collapsible: false,
            children: [{ id: "folder", label: "Folder", children: [{ id: "note", label: "Note" }] }],
          },
          {
            id: "resource",
            label: "Navigable resource",
            collapsible: false,
            navigationIntent: { id: "open" },
            children: [],
          },
        ],
      },
    ],
    [],
    ["folder"],
  );
  expect(rows.filter((row) => row.kind === "node").map((row) => [row.node.id, row.level, row.visualLevel])).toEqual([
    ["folder", 1, 0],
    ["note", 2, 1],
    ["resource", 0, undefined],
  ]);
  expect(
    resolveTreeListKeyboardNavigation({ rows, focusedRowId: "note", expandedNodeIds: ["folder"], key: "ArrowLeft" }),
  ).toEqual({ type: "focus", rowId: "folder" });
  expect(
    resolveTreeListKeyboardNavigation({ rows, focusedRowId: "folder", expandedNodeIds: [], key: "ArrowRight" }),
  ).toEqual({ type: "toggle-node", nodeId: "folder" });
});

test("fixed resource rows keep visible numeric adornments", () => {
  for (const field of ["icon", "description", "startContent", "endContent", "tooltip"] as const) {
    const rows = buildVirtualRows(
      [{ id: "resources", nodes: [{ id: "count", label: "Count", collapsible: false, children: [], [field]: 0 }] }],
      [],
      [],
    );
    expect(rows[0]?.kind).toBe("node");
  }
});
