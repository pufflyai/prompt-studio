import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../theme";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";
import { buildVirtualRows, resolveTreeListKeyboardNavigation } from "./tree-list-model";

test("noncollapsible groups show their children before the collection continuation", () => {
  const sections: TreeListSection[] = [
    {
      id: "resources",
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
  expect(rows.filter((row) => row.kind === "node").map((row) => row.node.id)).toEqual(["custom", "first", "second"]);
  expect(
    resolveTreeListKeyboardNavigation({ rows, focusedRowId: "custom", expandedNodeIds: [], key: "ArrowRight" }),
  ).toMatchObject({ type: "focus", rowId: "first" });
  const markup = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <TreeList sections={sections} />
    </ChakraProvider>,
  );
  expect(markup.includes("First resource")).toBe(true);
  expect(markup.includes("Second resource")).toBe(true);
});
