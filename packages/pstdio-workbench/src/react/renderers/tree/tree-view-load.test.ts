import { describe, expect, test } from "bun:test";
import { createTreeRendererRegistry, createWorkbenchRendererRegistry } from "../../../core";
import { expandDefaultTreeSections, loadExpandedTreeChildren, loadTreeData } from "./tree-view-load";

const createTrees = () => {
  const rendererRegistry = createWorkbenchRendererRegistry();
  return createTreeRendererRegistry({ rendererRegistry });
};
test("expanded folder reads have at most four outstanding transports", async () => {
  const trees = createTrees();
  let active = 0;
  let peak = 0;
  const nodes = Array.from({ length: 20 }, (_, index) => ({ id: String(index), label: String(index) }));
  trees.registerTreeRenderer({
    id: "bounded",
    title: "Folders",
    getBody: () => [{ id: "root", nodes }],
    getChildren: async () => {
      active++;
      peak = Math.max(peak, active);
      await Bun.sleep(1);
      active--;
      return [];
    },
  });
  const data = await loadTreeData(trees, "bounded");
  await loadExpandedTreeChildren(
    trees,
    "bounded",
    data!,
    nodes.map((node) => node.id),
  );
  expect(peak).toBeLessThanOrEqual(4);
  expect(active).toBe(0);
});

test("a failed section aborts its siblings and waits for them to settle", async () => {
  const trees = createTrees();
  const child = Promise.withResolvers<[]>();
  let signal: AbortSignal | undefined;
  let settled = false;
  trees.registerTreeRenderer({
    id: "failure",
    title: "Folders",
    getBody: () => {
      throw new Error("failed");
    },
    getHeader: (ctx) => {
      signal = ctx.signal;
      return child.promise;
    },
    getChildren: () => [],
  });
  const loading = loadTreeData(trees, "failure").catch(() => {
    settled = true;
  });
  await Bun.sleep(0);
  expect(signal?.aborted).toBe(true);
  expect(settled).toBe(false);
  child.resolve([]);
  await loading;
  expect(settled).toBe(true);
});
describe("loadTreeData", () => {
  test("passes the widget resource to tree renderer loaders", async () => {
    const trees = createTrees();
    const resource = {
      type: "ticket",
      label: "PS-265",
      id: "pstdio://tickets/PS-265",
    };
    trees.registerTreeRenderer({
      id: "ticket.files",
      title: "Files",
      getBody: (ctx) => {
        expect(ctx.resource).toEqual(resource);
        return [{ id: "files", nodes: [{ id: "ticket.md", label: "ticket.md" }] }];
      },
      getHeader: (ctx) => {
        expect(ctx.resource).toEqual(resource);
        return [{ id: "header", nodes: [{ id: "search", label: "Search" }] }];
      },
      getFooter: (ctx) => {
        expect(ctx.resource).toEqual(resource);
        return [{ id: "footer", nodes: [{ id: "help", label: "Help" }] }];
      },
      getChildren: () => [],
    });
    await expect(loadTreeData(trees, "ticket.files", { resource })).resolves.toEqual({
      header: [{ id: "header", nodes: [{ id: "search", label: "Search" }] }],
      body: [{ id: "files", nodes: [{ id: "ticket.md", label: "ticket.md" }] }],
      footer: [{ id: "footer", nodes: [{ id: "help", label: "Help" }] }],
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
describe("loadExpandedTreeChildren", () => {
  test("reloads every expanded lazy folder without collapsing it", async () => {
    const trees = createTrees();
    const resource = {
      type: "workspace",
      label: "one",
      id: "pstdio://workspaces/one",
    };
    trees.registerTreeRenderer({
      id: "workspace.files",
      title: "Files",
      getBody: () => [{ id: "files", nodes: [{ id: "src", label: "src", collapsible: true }] }],
      getChildren: (node) =>
        node.id === "src"
          ? [{ id: "src/components", label: "components", collapsible: true }]
          : [{ id: "src/components/button.tsx", label: "button.tsx" }],
    });
    const data = await loadTreeData(trees, "workspace.files", { resource });
    if (!data) throw new Error("Expected tree data.");
    await expect(
      loadExpandedTreeChildren(trees, "workspace.files", data, ["src", "src/components"], { resource }),
    ).resolves.toEqual({
      src: [{ id: "src/components", label: "components", collapsible: true }],
      "src/components": [{ id: "src/components/button.tsx", label: "button.tsx" }],
    });
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
