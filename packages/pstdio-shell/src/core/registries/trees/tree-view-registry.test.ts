import { describe, expect, test } from "bun:test";
import { createTreeViewRegistry, type PersistedTreeViewStates } from "./tree-view-registry";

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

  test("tracks module-controlled loading state without persisting it", () => {
    const stored: PersistedTreeViewStates[] = [];
    const persistence = {
      getTreeStates: () => stored.at(-1),
      setTreeStates: (next: PersistedTreeViewStates) => {
        stored.push(next);
      },
    };

    const trees = createTreeViewRegistry({ persistence });

    trees.registerTreeView({
      id: "sessions.tree",
      title: "Sessions",
      area: "left",
      getRoots: () => [],
      getChildren: () => [],
    });

    expect(trees.getViewState("sessions.tree").loading).toBeUndefined();

    trees.setLoading("sessions.tree", true);
    expect(trees.getViewState("sessions.tree").loading).toBe(true);

    trees.setLoading("sessions.tree", false);
    expect(trees.getViewState("sessions.tree").loading).toBe(false);

    for (const snapshot of stored) {
      expect(snapshot.statesByViewId["sessions.tree"]?.loading).toBeUndefined();
    }
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

  test("exposes store state and notifies subscribers as state mutates", () => {
    const trees = createTreeViewRegistry();
    const events: number[] = [];

    trees.registerTreeView({
      id: "settings.tree",
      title: "Settings",
      area: "left",
      getRoots: () => [],
      getChildren: () => [],
    });

    const unsubscribe = trees.store.subscribeSelector(
      (state) => state.statesByViewId["settings.tree"]?.expandedSectionIds.length ?? 0,
      (value) => events.push(value),
    );

    trees.setSectionExpanded("settings.tree", "general", true);
    trees.setSectionExpanded("settings.tree", "templates", true);
    trees.setSectionExpanded("settings.tree", "general", false);

    expect(events).toEqual([1, 2, 1]);
    unsubscribe();
  });

  test("hydrates from persisted state and writes through to the adapter", () => {
    const stored: PersistedTreeViewStates[] = [
      {
        statesByViewId: {
          "settings.tree": {
            expandedNodeIds: ["repositories"],
            expandedSectionIds: ["templates"],
            selectedNodeId: "repositories",
          },
        },
      },
    ];

    const persistence = {
      getTreeStates: () => stored.at(-1),
      setTreeStates: (next: PersistedTreeViewStates) => {
        stored.push(next);
      },
    };

    const trees = createTreeViewRegistry({ persistence });

    trees.registerTreeView({
      id: "settings.tree",
      title: "Settings",
      area: "left",
      defaultExpandedSectionIds: ["general"],
      getRoots: () => [],
      getChildren: () => [],
    });

    expect(trees.getViewState("settings.tree")).toEqual({
      expandedNodeIds: ["repositories"],
      expandedSectionIds: ["templates"],
      selectedNodeId: "repositories",
    });

    trees.setSectionExpanded("settings.tree", "general", true);

    expect(stored.at(-1)?.statesByViewId["settings.tree"]?.expandedSectionIds).toEqual(["templates", "general"]);
  });

  test("uses defaults when persisted state lacks an entry", () => {
    const persistence = {
      getTreeStates: () => ({ statesByViewId: {} }),
      setTreeStates: () => undefined,
    };

    const trees = createTreeViewRegistry({ persistence });

    trees.registerTreeView({
      id: "settings.tree",
      title: "Settings",
      area: "left",
      defaultExpandedSectionIds: ["general"],
      getRoots: () => [],
      getChildren: () => [],
    });

    expect(trees.getViewState("settings.tree")).toEqual({
      expandedNodeIds: [],
      expandedSectionIds: ["general"],
    });
  });
});
