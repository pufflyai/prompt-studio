import { describe, expect, test } from "bun:test";
import { createTreeRendererRegistry, createWorkbenchRendererRegistry } from "../../../core";
import { loadTreeData } from "./tree-view-load";

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
