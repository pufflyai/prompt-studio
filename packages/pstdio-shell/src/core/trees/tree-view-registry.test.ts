import { describe, expect, test } from "bun:test";
import { createTreeViewRegistry } from "./tree-view-registry";

describe("createTreeViewRegistry", () => {
  test("registers tree views and delegates node loading to the contribution", async () => {
    const trees = createTreeViewRegistry();

    trees.registerTreeView({
      id: "sessions.tree",
      title: "Sessions",
      area: "left",
      getRoots: async () => [
        {
          id: "s1",
          label: "Session 1",
          resource: { kind: "session", uri: "pstdio://session/s1" },
          collapsible: true,
        },
      ],
      getChildren: async (node) => [{ id: `${node.id}:log`, label: "Log" }],
    });

    await expect(trees.getRoots("sessions.tree")).resolves.toMatchObject([{ id: "s1", label: "Session 1" }]);
    await expect(trees.getChildren("sessions.tree", { id: "s1", label: "Session 1" })).resolves.toMatchObject([
      { id: "s1:log", label: "Log" },
    ]);
  });

  test("loads grouped sections when contributed", async () => {
    const trees = createTreeViewRegistry();

    trees.registerTreeView({
      id: "settings.tree",
      title: "Settings",
      area: "left",
      getRoots: () => [],
      getSections: () => [
        {
          id: "general",
          label: "General",
          nodes: [{ id: "repositories", label: "Repositories" }],
        },
        {
          id: "templates",
          label: "Templates",
          nodes: [{ id: "prompt-templates", label: "Prompts" }],
        },
      ],
      getChildren: () => [],
    });

    await expect(trees.getSections("settings.tree")).resolves.toEqual([
      {
        id: "general",
        label: "General",
        nodes: [{ id: "repositories", label: "Repositories" }],
      },
      {
        id: "templates",
        label: "Templates",
        nodes: [{ id: "prompt-templates", label: "Prompts" }],
      },
    ]);
  });

  test("tracks expansion and selection state and emits refresh events", () => {
    const trees = createTreeViewRegistry();
    const refreshEvents: string[] = [];

    trees.registerTreeView({
      id: "sessions.tree",
      title: "Sessions",
      area: "left",
      getRoots: () => [],
      getChildren: () => [],
    });

    const disposable = trees.onDidRefresh((event) => {
      refreshEvents.push(event.treeViewId);
    });

    trees.setNodeExpanded("sessions.tree", "s1", true);
    trees.setSectionExpanded("sessions.tree", "active", true);
    trees.setSelectedNode("sessions.tree", "s1");
    trees.refresh("sessions.tree");

    expect(trees.getViewState("sessions.tree")).toEqual({
      expandedNodeIds: ["s1"],
      expandedSectionIds: ["active"],
      selectedNodeId: "s1",
    });
    expect(refreshEvents).toEqual(["sessions.tree"]);

    disposable.dispose();
    trees.refresh("sessions.tree");

    expect(refreshEvents).toEqual(["sessions.tree"]);
  });

  test("does not expand sections unless defaults or state opt in", () => {
    const trees = createTreeViewRegistry();

    trees.registerTreeView({
      id: "settings.tree",
      title: "Settings",
      area: "left",
      defaultExpandedSectionIds: ["general"],
      getRoots: () => [],
      getChildren: () => [],
    });

    expect(trees.getViewState("settings.tree").expandedSectionIds).toEqual(["general"]);

    trees.setSectionExpanded("settings.tree", "general", false);
    trees.setSectionExpanded("settings.tree", "templates", true);

    expect(trees.getViewState("settings.tree").expandedSectionIds).toEqual(["templates"]);
  });
});
