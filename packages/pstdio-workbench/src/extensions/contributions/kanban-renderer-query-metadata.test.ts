import { expect, test } from "bun:test";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { createWorkbench, getWorkbenchRenderers, type KanbanRendererQueryState } from "../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";

const createDeferred = <TValue>() => {
  let resolve!: (value: TValue) => void;
  const promise = new Promise<TValue>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

const queryState: KanbanRendererQueryState = {
  settings: {
    viewMode: "board",
    columnGrouping: "workflow",
    rowGrouping: "none",
    displayProperties: [],
  },
  filter: { conjunction: "and", rules: [] },
  sorts: [],
};

test("keeps rows and query metadata from the latest overlapping request", async () => {
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
    attributes: [],
  } satisfies WorkbenchExtensionKanbanRendererRecord;
  const workflow = createDeferred<unknown>();
  const review = createDeferred<unknown>();
  registerWorkbenchExtensionKanbanRenderers(
    {
      projectId: "project-1",
      workbench,
      executeCommand: async (_commandId, input) => {
        const settings = input.params?.settings as KanbanRendererQueryState["settings"] | undefined;
        if (!settings) throw new Error("Expected query settings");
        return settings.columnGrouping === "review" ? review.promise : workflow.promise;
      },
    },
    [record],
  );

  const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("recipes")!;
  const workflowQuery = renderer.executeQuery(queryState, new AbortController().signal);
  const reviewQuery = renderer.executeQuery(
    {
      ...queryState,
      settings: { ...queryState.settings, columnGrouping: "review" },
    },
    new AbortController().signal,
  );
  review.resolve({
    rows: [{ id: "latest", title: "Latest", attributes: {} }],
    attributes: [
      {
        id: "review",
        label: "Review",
        type: { kind: "status", statuses: { kind: "status", id: "review" } },
      },
    ],
    boardColumnConfigs: { "review-only": { canCreate: true } },
  });
  expect(await reviewQuery).toMatchObject([{ id: "latest" }]);

  workflow.resolve({
    rows: [{ id: "stale", title: "Stale", attributes: {} }],
    attributes: [
      {
        id: "workflow",
        label: "Workflow",
        type: { kind: "status", statuses: { kind: "status", id: "workflow" } },
      },
    ],
    boardColumnConfigs: { "workflow-only": { canCreate: true } },
  });
  await workflowQuery;

  if (!("getSnapshot" in renderer.attributes)) throw new Error("Expected live attributes");
  expect(renderer.attributes.getSnapshot()).toMatchObject([{ id: "review", type: { kind: "enum" } }]);
  expect(renderer.getBoardColumnConfig?.("todo").color).toBe("purple");
  expect(renderer.getBoardColumnConfig?.("review-only").canCreate).toBe(true);
  expect(renderer.getBoardColumnConfig?.("workflow-only").canCreate).toBeUndefined();
});

test("refreshes query-owned enum choices and column rules without a status provider", async () => {
  const workbench = createWorkbench();
  let options = [{ value: "todo", label: "Todo", color: "blue", icon: "Circle" }];
  const record = {
    id: "categories",
    extensionId: "example.categories",
    title: "Categories",
    queryHandlerId: "categories.query",
    attributes: [],
  } satisfies WorkbenchExtensionKanbanRendererRecord;
  registerWorkbenchExtensionKanbanRenderers(
    {
      projectId: "project-1",
      workbench,
      executeCommand: async () => ({
        rows: [{ id: "task", title: "Task", attributes: { workflow: "todo" } }],
        attributes: [
          { id: "workflow", label: "Workflow", type: { kind: "enum", options }, filterable: true, groupable: true },
        ],
        boardColumnConfigs: {
          todo: {
            color: options[0]!.color,
            canDragIn: false,
            canDragOut: true,
            canCreate: true,
            actions: [{ id: "archive", label: "Archive" }],
          },
        },
      }),
    },
    [record],
  );
  const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("categories")!;
  if (!("getSnapshot" in renderer.attributes)) throw new Error("Expected live attributes");
  let notifications = 0;
  const dispose = renderer.attributes.subscribe(() => {
    notifications += 1;
  });
  await renderer.executeQuery(queryState, new AbortController().signal);
  expect(renderer.attributes.getSnapshot()).toMatchObject([{ type: { kind: "enum", options } }]);
  options = [{ value: "todo", label: "Ready", color: "purple", icon: "Check" }];
  await renderer.executeQuery(queryState, new AbortController().signal);
  expect(renderer.attributes.getSnapshot()).toMatchObject([{ type: { kind: "enum", options } }]);
  expect(notifications).toBe(2);
  expect(renderer.getBoardColumnConfig?.("todo")).toMatchObject({
    color: "purple",
    canDragIn: false,
    canDragOut: true,
    canCreate: true,
    actions: [{ id: "archive", label: "Archive" }],
  });
  dispose();
});
