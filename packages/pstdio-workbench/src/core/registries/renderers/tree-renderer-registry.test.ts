import { describe, expect, test } from "bun:test";
import { createWorkbenchRendererRegistry } from "./renderer-registry";
import { createTreeRendererRegistry, type PersistedTreeRendererStates } from "./tree-renderer-registry";

const createRegistry = (input: { persistence?: PersistedTreeRendererStates } = {}) => {
  const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
  if (input.persistence) {
    const persistence = {
      getTreeStates: () => input.persistence,
      setTreeStates: () => undefined,
    };
    return { rendererRegistry, trees: createTreeRendererRegistry({ rendererRegistry, persistence }) };
  }
  return { rendererRegistry, trees: createTreeRendererRegistry({ rendererRegistry }) };
};

describe("createTreeRendererRegistry", () => {
  test("registers tree renderers and delegates body/footer/children loading to the contribution", async () => {
    const { trees } = createRegistry();

    trees.registerTreeRenderer({
      id: "sessions.tree",
      title: "Sessions",
      getBody: async () => [
        {
          id: "active",
          nodes: [
            {
              id: "s1",
              label: "Session 1",
              resource: { kind: "session", uri: "pstdio://session/s1" },
              collapsible: true,
            },
          ],
        },
      ],
      getFooter: async () => [{ id: "help", label: "Help" }],
      getChildren: async (node) => [{ id: `${node.id}:log`, label: "Log" }],
    });

    await expect(trees.getBody("sessions.tree")).resolves.toMatchObject([
      { id: "active", nodes: [{ id: "s1", label: "Session 1" }] },
    ]);
    await expect(trees.getFooter("sessions.tree")).resolves.toEqual([{ id: "help", label: "Help" }]);
    await expect(trees.getChildren("sessions.tree", { id: "s1", label: "Session 1" })).resolves.toMatchObject([
      { id: "s1:log", label: "Log" },
    ]);
  });

  test("returns an empty footer when getFooter is not provided", async () => {
    const { trees } = createRegistry();

    trees.registerTreeRenderer({
      id: "settings.tree",
      title: "Settings",
      getBody: () => [{ id: "general", nodes: [] }],
      getChildren: () => [],
    });

    await expect(trees.getFooter("settings.tree")).resolves.toEqual([]);
  });

  test("auto-registers a widget renderer with the same id", () => {
    const { rendererRegistry, trees } = createRegistry();

    trees.registerTreeRenderer({
      id: "sessions.tree",
      title: "Sessions",
      getBody: () => [],
      getChildren: () => [],
    });

    expect(rendererRegistry.getRenderer("sessions.tree")).toBeDefined();
  });

  test("invokes the tree renderer implementation when the widget renderer renders", () => {
    const { rendererRegistry, trees } = createRegistry();
    const calls: { treeId: string }[] = [];
    trees.setTreeRendererImplementation((input) => {
      calls.push({ treeId: input.treeId });
      return null;
    });

    trees.registerTreeRenderer({
      id: "sessions.tree",
      title: "Sessions",
      getBody: () => [],
      getChildren: () => [],
    });

    const renderer = rendererRegistry.getRenderer("sessions.tree");
    if (!renderer || renderer.keepAlive) throw new Error("expected non-keep-alive renderer");
    renderer.render({} as Parameters<typeof renderer.render>[0]);

    expect(calls).toEqual([{ treeId: "sessions.tree" }]);
  });

  test("unregisters the tree renderer and its auto-registered widget renderer together", () => {
    const { rendererRegistry, trees } = createRegistry();

    const disposable = trees.registerTreeRenderer({
      id: "sessions.tree",
      title: "Sessions",
      getBody: () => [],
      getChildren: () => [],
    });

    expect(rendererRegistry.getRenderer("sessions.tree")).toBeDefined();
    disposable.dispose();
    expect(rendererRegistry.getRenderer("sessions.tree")).toBeUndefined();
    expect(trees.getTreeRenderer("sessions.tree")).toBeUndefined();
  });

  test("tracks expansion and selection state and emits refresh events", () => {
    const { trees } = createRegistry();
    const refreshEvents: string[] = [];

    trees.registerTreeRenderer({
      id: "sessions.tree",
      title: "Sessions",
      getBody: () => [],
      getChildren: () => [],
    });

    const disposable = trees.onDidRefresh((event) => {
      refreshEvents.push(event.treeId);
    });

    trees.setNodeExpanded("sessions.tree", "s1", true);
    trees.setSectionExpanded("sessions.tree", "active", true);
    trees.setSelectedNode("sessions.tree", "s1");
    trees.refresh("sessions.tree");

    expect(trees.getTreeState("sessions.tree")).toEqual({
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
    const stored: PersistedTreeRendererStates[] = [];
    const persistence = {
      getTreeStates: () => stored.at(-1),
      setTreeStates: (next: PersistedTreeRendererStates) => {
        stored.push(next);
      },
    };
    const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
    const trees = createTreeRendererRegistry({ rendererRegistry, persistence });

    trees.registerTreeRenderer({
      id: "sessions.tree",
      title: "Sessions",
      getBody: () => [],
      getChildren: () => [],
    });

    expect(trees.getTreeState("sessions.tree").loading).toBeUndefined();

    trees.setLoading("sessions.tree", true);
    expect(trees.getTreeState("sessions.tree").loading).toBe(true);

    trees.setLoading("sessions.tree", false);
    expect(trees.getTreeState("sessions.tree").loading).toBe(false);

    for (const snapshot of stored) {
      expect(snapshot.statesByTreeId["sessions.tree"]?.loading).toBeUndefined();
    }
  });

  test("does not expand sections unless defaults or state opt in", () => {
    const { trees } = createRegistry();

    trees.registerTreeRenderer({
      id: "settings.tree",
      title: "Settings",
      defaultExpandedSectionIds: ["general"],
      getBody: () => [],
      getChildren: () => [],
    });

    expect(trees.getTreeState("settings.tree").expandedSectionIds).toEqual(["general"]);
    expect(trees.treeStore.getState().statesByTreeId["settings.tree"]?.expandedSectionIds).toEqual(["general"]);

    trees.setSectionExpanded("settings.tree", "general", false);
    trees.setSectionExpanded("settings.tree", "templates", true);

    expect(trees.getTreeState("settings.tree").expandedSectionIds).toEqual(["templates"]);
  });

  test("exposes store state and notifies subscribers as state mutates", () => {
    const { trees } = createRegistry();
    const events: number[] = [];

    trees.registerTreeRenderer({
      id: "settings.tree",
      title: "Settings",
      getBody: () => [],
      getChildren: () => [],
    });

    const unsubscribe = trees.treeStore.subscribeSelector(
      (state) => state.statesByTreeId["settings.tree"]?.expandedSectionIds.length ?? 0,
      (value) => events.push(value),
    );

    trees.setSectionExpanded("settings.tree", "general", true);
    trees.setSectionExpanded("settings.tree", "templates", true);
    trees.setSectionExpanded("settings.tree", "general", false);

    expect(events).toEqual([1, 2, 1]);
    unsubscribe();
  });

  test("hydrates from persisted state and writes through to the adapter", () => {
    const stored: PersistedTreeRendererStates[] = [
      {
        statesByTreeId: {
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
      setTreeStates: (next: PersistedTreeRendererStates) => {
        stored.push(next);
      },
    };
    const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
    const trees = createTreeRendererRegistry({ rendererRegistry, persistence });

    trees.registerTreeRenderer({
      id: "settings.tree",
      title: "Settings",
      defaultExpandedSectionIds: ["general"],
      getBody: () => [],
      getChildren: () => [],
    });

    expect(trees.getTreeState("settings.tree")).toEqual({
      expandedNodeIds: ["repositories"],
      expandedSectionIds: ["templates"],
      selectedNodeId: "repositories",
    });

    trees.setSectionExpanded("settings.tree", "general", true);

    expect(stored.at(-1)?.statesByTreeId["settings.tree"]?.expandedSectionIds).toEqual(["templates", "general"]);
  });

  test("uses defaults when persisted state lacks an entry", () => {
    const persistence = {
      getTreeStates: () => ({ statesByTreeId: {} }),
      setTreeStates: () => undefined,
    };
    const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
    const trees = createTreeRendererRegistry({ rendererRegistry, persistence });

    trees.registerTreeRenderer({
      id: "settings.tree",
      title: "Settings",
      defaultExpandedSectionIds: ["general"],
      getBody: () => [],
      getChildren: () => [],
    });

    expect(trees.getTreeState("settings.tree")).toEqual({
      expandedNodeIds: [],
      expandedSectionIds: ["general"],
    });
  });
});
