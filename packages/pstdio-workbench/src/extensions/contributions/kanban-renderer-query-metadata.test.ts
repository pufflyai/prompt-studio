import { expect, test } from "bun:test";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { createWorkbenchCore, type KanbanRendererQueryState } from "../../core";
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
    ordering: { attributeId: "manual", direction: "asc" },
    displayProperties: [],
  },
  filters: {},
};

test("keeps rows and query metadata from the latest overlapping request", async () => {
  const workbench = createWorkbenchCore();
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

  const renderer = workbench.renderers.getKanbanRenderer("recipes")!;
  const workflowQuery = renderer.executeQuery(queryState);
  const reviewQuery = renderer.executeQuery({
    ...queryState,
    settings: { ...queryState.settings, columnGrouping: "review" },
  });
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
