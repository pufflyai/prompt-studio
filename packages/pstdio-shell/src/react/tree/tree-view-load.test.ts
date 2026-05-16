import { describe, expect, test } from "bun:test";
import { createTreeViewRegistry } from "../../core";
import { loadTreeSections } from "./tree-view-load";

describe("loadTreeSections", () => {
  test("ignores a tree view that was unregistered before stale effects load it", async () => {
    const trees = createTreeViewRegistry();
    const registration = trees.registerTreeView({
      id: "workbench.navigation",
      title: "Workbench",
      getRoots: () => [{ id: "settings", label: "Settings" }],
      getChildren: () => [],
    });

    registration.dispose();

    await expect(loadTreeSections(trees, "workbench.navigation")).resolves.toBeNull();
  });
});
