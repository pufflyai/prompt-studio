import { describe, expect, test } from "bun:test";
import type { TreeListNode } from "@pstdio/ui";
import { addRegionNodeVisibilityContextMenuItems } from "./use-tree-view-customization";

describe("addRegionNodeVisibilityContextMenuItems", () => {
  const icons = { visibleIcon: "eye", hiddenIcon: "eye-off" };

  test("adds row context toggles for hideable region nodes", () => {
    const toggled: Array<{ id: string; hiddenByDefault: boolean }> = [];
    const [node] = addRegionNodeVisibilityContextMenuItems(
      [
        {
          id: "search",
          label: "Search",
          canHide: true,
          contextMenuItems: [{ id: "inspect", label: "Inspect" }],
        },
      ],
      {},
      { onToggleNode: (id, hiddenByDefault) => toggled.push({ id, hiddenByDefault }) },
      icons,
    );

    expect(node.contextMenuItems?.map((item) => item.id)).toEqual(["inspect", "tree-visibility:search"]);
    expect(node.contextMenuItems?.[1]?.separatorBefore).toBe(true);

    node.contextMenuItems?.[1]?.onAction?.();

    expect(toggled).toEqual([{ id: "search", hiddenByDefault: false }]);
  });

  test("leaves fixed region nodes unchanged", () => {
    const nodes: TreeListNode[] = [{ id: "fixed", label: "Fixed" }];

    expect(addRegionNodeVisibilityContextMenuItems(nodes, {}, { onToggleNode: () => {} }, icons)).toBe(nodes);
  });
});
