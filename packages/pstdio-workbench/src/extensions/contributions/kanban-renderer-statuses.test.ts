import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";

import { queryState } from "./kanban-renderer-query.fixture";

describe("registerWorkbenchExtensionKanbanRenderers workflow statuses", () => {
  test("resolves independent live workflow status sets", async () => {
    const workbench = createWorkbench();
    const firstId = "pstdio.planner.status.first";
    const secondId = "pstdio.planner.status.second";
    workbench.statuses.registerStatusSet({
      id: firstId,
      title: "First",
      query: () => [{ id: "todo", label: "Todo", color: "blue", sortOrder: 0 }],
      save: (statuses) => statuses,
    });
    workbench.statuses.registerStatusSet({
      id: secondId,
      title: "Second",
      query: () => [{ id: "todo", label: "Queued", color: "purple", sortOrder: 0 }],
    });
    await Promise.all([workbench.statuses.query(firstId), workbench.statuses.query(secondId)]);
    const record = (id: string, statusId: string) =>
      ({
        id,
        extensionId: "pstdio.planner",
        title: id,
        queryHandlerId: `${id}.query`,
        attributes: [
          {
            id: "status",
            label: "Status",
            type: { kind: "status", statuses: { kind: "status", id: statusId } },
          },
        ],
      }) satisfies WorkbenchExtensionKanbanRendererRecord;

    registerWorkbenchExtensionKanbanRenderers(
      { projectId: "project-1", workbench, executeCommand: async () => ({ rows: [] }) },
      [record("first-board", "first"), record("second-board", "second")],
    );

    expect(
      getWorkbenchRenderers(workbench).getKanbanRenderer("first-board")?.getBoardColumnConfig?.("todo").color,
    ).toBe("blue");
    expect(
      getWorkbenchRenderers(workbench).getKanbanRenderer("second-board")?.getBoardColumnConfig?.("todo").color,
    ).toBe("purple");

    await workbench.statuses.save(firstId, [{ id: "todo", label: "Todo", color: "green", sortOrder: 0 }]);

    expect(
      getWorkbenchRenderers(workbench).getKanbanRenderer("first-board")?.getBoardColumnConfig?.("todo").color,
    ).toBe("green");
    expect(
      getWorkbenchRenderers(workbench).getKanbanRenderer("second-board")?.getBoardColumnConfig?.("todo").color,
    ).toBe("purple");
  });

  test("keeps declared attributes when a query returns only rows", async () => {
    const workbench = createWorkbench();
    workbench.statuses.registerStatusSet({
      id: "pstdio.lab.status.workflow",
      title: "Workflow",
      query: () => [{ id: "idea", label: "Idea", color: "gray", sortOrder: 0 }],
    });
    await workbench.statuses.query("pstdio.lab.status.workflow");
    const record = {
      id: "workflow",
      extensionId: "pstdio.lab",
      title: "Workflow",
      queryHandlerId: "workflow.query",
      attributes: [
        {
          id: "status",
          label: "Status",
          type: { kind: "status", statuses: { kind: "status", id: "workflow" } },
        },
      ],
    } satisfies WorkbenchExtensionKanbanRendererRecord;
    registerWorkbenchExtensionKanbanRenderers(
      { projectId: "project-1", workbench, executeCommand: async () => ({ rows: [] }) },
      [record],
    );

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("workflow")!;
    if (!("getSnapshot" in renderer.attributes)) throw new Error("Expected live status attributes");
    expect(renderer.attributes.getSnapshot()).toHaveLength(1);
    await renderer.executeQuery(queryState, new AbortController().signal);
    expect(renderer.attributes.getSnapshot()).toHaveLength(1);
  });

  test("uses board column configs for a declared status attribute", async () => {
    const workbench = createWorkbench();
    workbench.statuses.registerStatusSet({
      id: "pstdio.planner.status.tickets",
      title: "Tickets",
      query: () => [{ id: "todo", label: "Todo", color: "blue", sortOrder: 0 }],
    });
    const record = {
      id: "tickets",
      extensionId: "pstdio.planner",
      title: "Tickets",
      queryHandlerId: "tickets.query",
      attributes: [
        {
          id: "status",
          label: "Status",
          type: { kind: "status", statuses: { kind: "status", id: "tickets" } },
        },
      ],
    } satisfies WorkbenchExtensionKanbanRendererRecord;
    registerWorkbenchExtensionKanbanRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async () => ({ rows: [], boardColumnConfigs: { todo: { color: "red" } } }),
      },
      [record],
    );

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("tickets");
    await renderer?.executeQuery(queryState, new AbortController().signal);

    expect(renderer?.getBoardColumnConfig?.("todo").color).toBe("red");
  });

  test("uses the status color when a board does not configure the column", async () => {
    const workbench = createWorkbench();
    workbench.statuses.registerStatusSet({
      id: "example.recipes.status.workflow",
      title: "Recipe workflow",
      query: () => [{ id: "draft", label: "Draft", color: "orange", sortOrder: 0 }],
    });
    await workbench.statuses.query("example.recipes.status.workflow");
    const record = {
      id: "recipes",
      extensionId: "example.recipes",
      title: "Recipes",
      queryHandlerId: "recipes.query",
      attributes: [
        {
          id: "status",
          label: "Status",
          type: { kind: "status", statuses: { kind: "status", id: "workflow" } },
        },
      ],
    } satisfies WorkbenchExtensionKanbanRendererRecord;
    registerWorkbenchExtensionKanbanRenderers(
      { projectId: "project-1", workbench, executeCommand: async () => ({ rows: [] }) },
      [record],
    );

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("recipes");
    await renderer?.executeQuery(queryState, new AbortController().signal);

    expect(renderer?.getBoardColumnConfig?.("draft").color).toBe("orange");
  });

  test("uses the status color from the active column grouping", async () => {
    const workbench = createWorkbench();
    workbench.statuses.registerStatusSet({
      id: "example.recipes.status.workflow",
      title: "Workflow",
      query: () => [{ id: "todo", label: "Todo", color: "blue", sortOrder: 0 }],
    });
    workbench.statuses.registerStatusSet({
      id: "example.recipes.status.review",
      title: "Review",
      query: () => [{ id: "todo", label: "Todo", color: "purple", sortOrder: 0 }],
    });
    await Promise.all([
      workbench.statuses.query("example.recipes.status.workflow"),
      workbench.statuses.query("example.recipes.status.review"),
    ]);
    const record = {
      id: "recipes",
      extensionId: "example.recipes",
      title: "Recipes",
      queryHandlerId: "recipes.query",
      attributes: [
        {
          id: "workflow",
          label: "Workflow",
          type: { kind: "status", statuses: { kind: "status", id: "workflow" } },
        },
        {
          id: "review",
          label: "Review",
          type: { kind: "status", statuses: { kind: "status", id: "review" } },
        },
      ],
    } satisfies WorkbenchExtensionKanbanRendererRecord;
    registerWorkbenchExtensionKanbanRenderers(
      { projectId: "project-1", workbench, executeCommand: async () => ({ rows: [] }) },
      [record],
    );

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("recipes");
    await renderer?.executeQuery(
      {
        ...queryState,
        settings: { ...queryState.settings, columnGrouping: "review" },
      },
      new AbortController().signal,
    );

    expect(renderer?.getBoardColumnConfig?.("todo").color).toBe("purple");
  });

  test("reports an unknown display kind and falls back to the attribute type", () => {
    const workbench = createWorkbench();
    const record = {
      id: "recipes",
      extensionId: "example.recipes",
      title: "Recipes",
      queryHandlerId: "recipes.query",
      attributes: [
        {
          id: "season",
          label: "Season",
          type: { kind: "string" },
          display: { kind: "portrait-stack", itemsAttributeId: "seasonItems" },
        },
      ],
    } satisfies WorkbenchExtensionKanbanRendererRecord;

    registerWorkbenchExtensionKanbanRenderers(
      { projectId: "project-1", workbench, executeCommand: async () => ({ rows: [] }) },
      [record],
    );

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("recipes")!;
    if (!("getSnapshot" in renderer.attributes)) throw new Error("Expected live attributes");
    expect(renderer.attributes.getSnapshot()[0]?.display).toBeUndefined();
    expect(workbench.notifications.listNotifications()).toMatchObject([
      {
        level: "error",
        title: "Extension display is not available",
        message: 'Attribute "season" in renderer "recipes" uses unknown display kind "portrait-stack".',
      },
    ]);
  });
});
