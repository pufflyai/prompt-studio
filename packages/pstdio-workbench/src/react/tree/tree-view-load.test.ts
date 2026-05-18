import { describe, expect, test } from "bun:test";
import { createTreeRendererRegistry, createWorkbenchRendererRegistry } from "../../core";
import { loadTreeData } from "./tree-view-load";

const createTrees = () => {
  const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
  return createTreeRendererRegistry({ rendererRegistry });
};

describe("loadTreeData", () => {
  test("ignores a tree renderer that was unregistered before stale effects load it", async () => {
    const trees = createTrees();
    const registration = trees.registerTreeRenderer({
      id: "workbench.navigation",
      title: "Workbench",
      getBody: () => [{ id: "root", nodes: [{ id: "settings", label: "Settings" }] }],
      getChildren: () => [],
    });

    registration.dispose();

    await expect(loadTreeData(trees, "workbench.navigation")).resolves.toBeNull();
  });
});
