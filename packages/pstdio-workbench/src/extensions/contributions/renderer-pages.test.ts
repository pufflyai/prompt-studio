import { expect, test } from "bun:test";
import { DEFAULT_DATA_TABLE_SETTINGS } from "@pstdio/sdk/extensions";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionDataTableRenderers } from "./data-table-renderer-contributions";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";
import { queryState } from "./kanban-renderer-query.fixture";

const request = {
  limit: 100,
  offset: 100,
  cursor: "after-first",
  revision: "revision-1",
  fields: ["title"],
  search: "saved",
};
const page = { revision: "revision-1", cursor: "after-second", total: 300, filteredTotal: 250, groups: [] };

test("paged table queries preserve bounded requests, owner context and aggregate metadata", async () => {
  const workbench = createWorkbench();
  const calls: unknown[] = [];
  const abort = new AbortController();
  registerWorkbenchExtensionDataTableRenderers(
    {
      projectId: "project-one",
      workbench,
      executeCommand: async (_id, input, signal) => {
        calls.push({ ...input, signal });
        return { rows: [{ id: "selected", values: { title: "Saved" } }], page };
      },
    },
    [{ id: "table", extensionId: "owner.one", title: "Table", queryHandlerId: "table.query", queryMode: "paged" }],
  );
  const renderer = getWorkbenchRenderers(workbench).getDataTableRenderer("table")!;
  const result = await renderer.executeQuery(
    { settings: DEFAULT_DATA_TABLE_SETTINGS, filter: queryState.filter, sorts: [], page: request },
    abort.signal,
  );
  expect(renderer.queryMode).toBe("paged");
  expect(result.page).toEqual(page);
  expect(result.rows).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    projectId: "project-one",
    params: { page: request, renderer: { projectId: "project-one" } },
    signal: abort.signal,
  });
});

test("paged boards retain their page contract while legacy queries still return arrays", async () => {
  const workbench = createWorkbench();
  const calls: unknown[] = [];
  registerWorkbenchExtensionKanbanRenderers(
    {
      projectId: "project-one",
      workbench,
      executeCommand: async (_id, input) => {
        calls.push(input);
        return { rows: [{ id: "selected", title: "Saved", attributes: {} }], page };
      },
    },
    [{ id: "board", extensionId: "owner.one", title: "Board", queryHandlerId: "board.query", queryMode: "paged" }],
  );
  const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("board")!;
  const result = await renderer.executePage!({ ...queryState, page: request }, new AbortController().signal);
  expect(result.page).toEqual(page);
  expect(result.rows).toMatchObject([{ id: "selected" }]);
  expect(calls[0]).toMatchObject({ params: { page: request } });
  expect(await renderer.executeQuery(queryState, new AbortController().signal)).toMatchObject([{ id: "selected" }]);
});
