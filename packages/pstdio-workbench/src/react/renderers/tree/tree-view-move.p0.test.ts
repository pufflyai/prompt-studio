import { expect, test } from "bun:test";
import { createNavigationTreeRegistry } from "../../../core/registries/navigation/navigation-tree-registry";
import { shareEqualValue } from "../share-equal-value";
import { canMoveTreeNode } from "./tree-view-move";

test("a tree shared with the rows on screen still moves nodes after one of them changed", async () => {
  let title = "Plan";
  const registry = createNavigationTreeRegistry({});
  const owner = { kind: "mode", id: "project", extensionId: "pstdio" } as const;
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "notes",
    declarationIndex: 0,
    getSections: () => [
      {
        id: "notes",
        nodes: [
          {
            id: "root",
            label: "Notes",
            canDrop: true,
            children: [
              { id: "plan", label: title, canDrag: true, canDrop: true },
              { id: "other", label: "Other", canDrag: true },
            ],
          },
        ],
      },
    ],
  });
  const shown = await registry.getSections(owner, "content", {});
  title = "Roadmap";
  const loaded = await registry.getSections(owner, "content", {});
  const sections = shareEqualValue(shown, loaded);

  expect(canMoveTreeNode({ sections, childrenByNodeId: {} }, "other", "root")).toBe(true);
  expect(canMoveTreeNode({ sections, childrenByNodeId: {} }, "other", "plan")).toBe(true);
});
