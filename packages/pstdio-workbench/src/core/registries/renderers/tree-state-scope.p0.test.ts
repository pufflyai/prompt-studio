import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../index";

test("resource navigation state follows its owner between project navigation and a menu", () => {
  const workbench = createWorkbench();
  const trees = getWorkbenchRenderers(workbench);
  for (const id of ["project-navigation", "resources-menu"])
    workbench.views.registerView({ id, title: id, body: { kind: "tree", getBody: () => [], getChildren: () => [] } });
  trees.setNodeExpanded("project-navigation", "files", true, "project:ticket-a");
  trees.setSelectedNode("project-navigation", "readme", "project:ticket-a");
  expect(trees.getTreeState("resources-menu", "project:ticket-a")).toMatchObject({
    expandedNodeIds: ["files"],
    selectedNodeId: "readme",
  });
  expect(trees.getTreeState("resources-menu", "project:ticket-b").expandedNodeIds).toEqual([]);
  trees.setNodeExpanded("resources-menu", "files", false, "project:ticket-a");
  expect(trees.getTreeState("project-navigation", "project:ticket-a").expandedNodeIds).toEqual([]);
});
