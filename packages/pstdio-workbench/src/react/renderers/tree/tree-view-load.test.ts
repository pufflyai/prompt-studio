import { describe, expect, test } from "bun:test";
import { createTreeRendererRegistry, createWorkbenchRendererRegistry } from "../../../core";
import { expandDefaultTreeSections, loadTreeData, shouldShowTreeLoading } from "./tree-view-load";

const createTrees = () => {
  const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
  return createTreeRendererRegistry({ rendererRegistry });
};

describe("loadTreeData", () => {
  test("passes the widget resource to tree renderer loaders", async () => {
    const trees = createTrees();
    const resource = { kind: "ticket", uri: "pstdio://tickets/PS-265", label: "PS-265" };

    trees.registerTreeRenderer({
      id: "ticket.files",
      title: "Files",
      getBody: (ctx) => {
        expect(ctx.resource).toEqual(resource);
        return [{ id: "files", nodes: [{ id: "ticket.md", label: "ticket.md" }] }];
      },
      getFooter: (ctx) => {
        expect(ctx.resource).toEqual(resource);
        return [{ id: "footer", label: "Footer" }];
      },
      getChildren: () => [],
    });

    await expect(loadTreeData(trees, "ticket.files", { resource })).resolves.toEqual({
      body: [{ id: "files", nodes: [{ id: "ticket.md", label: "ticket.md" }] }],
      footer: [{ id: "footer", label: "Footer" }],
    });
  });

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

describe("expandDefaultTreeSections", () => {
  test("re-expands default sections when a tree view starts", () => {
    const trees = createTrees();

    trees.registerTreeRenderer({
      id: "ticket.files",
      title: "Files",
      defaultExpandedSectionIds: ["files", "workspaces"],
      getBody: () => [],
      getChildren: () => [],
    });

    trees.setSectionExpanded("ticket.files", "workspaces", false);

    expect(trees.getTreeState("ticket.files").expandedSectionIds).toEqual(["files"]);

    expandDefaultTreeSections(trees, "ticket.files");

    expect(trees.getTreeState("ticket.files").expandedSectionIds).toEqual(["files", "workspaces"]);
  });
});

describe("shouldShowTreeLoading", () => {
  test("shows the loading state on the first load of a tree", () => {
    expect(shouldShowTreeLoading(null, "workbench.settings.navigation")).toBe(true);
  });

  test("keeps content visible when reloading a tree that already loaded", () => {
    // Selecting a different item re-runs the load with the same tree id; the
    // sidebar must not blank between items.
    expect(shouldShowTreeLoading("workbench.settings.navigation", "workbench.settings.navigation")).toBe(false);
  });

  test("shows the loading state when the tree id changes", () => {
    expect(shouldShowTreeLoading("project.sidebar", "workbench.settings.navigation")).toBe(true);
  });
});
