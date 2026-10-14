import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";
import { queryState } from "./kanban-renderer-query.fixture";

test("complete drops call one mutation with grouping and manual placement", async () => {
  const workbench = createWorkbench();
  const calls: unknown[] = [];
  let completed = 0;
  registerWorkbenchExtensionKanbanRenderers(
    {
      workbench,
      projectId: "project",
      executeCommand: async (id, input) => {
        calls.push([id, input.params]);
      },
    },
    [{ id: "board", extensionId: "example", title: "Board", queryHandlerId: "query", moveHandlerId: "move" }],
    {
      onAfterMutation: () => {
        completed += 1;
      },
    },
  );
  await getWorkbenchRenderers(workbench).getKanbanRenderer("board")!.onMove!({
    rowId: "a",
    attributes: { status: "done", priority: "high" },
    order: { beforeRowId: "b" },
  });
  expect(calls).toEqual([
    [
      "move",
      expect.objectContaining({
        rowId: "a",
        attributes: { status: "done", priority: "high" },
        order: { beforeRowId: "b" },
      }),
    ],
  ]);
  expect(completed).toBe(1);
});

test("unchanged rows and attribute schema retain identities after content refresh", async () => {
  const workbench = createWorkbench();
  let title = "First";
  registerWorkbenchExtensionKanbanRenderers(
    {
      workbench,
      projectId: "project",
      executeCommand: async () => ({
        rows: [
          { id: "a", title, attributes: {} },
          { id: "b", title: "Second", attributes: {} },
        ],
        attributes: [{ id: "status", label: "Status", type: { kind: "string" } }],
      }),
    },
    [{ id: "board", extensionId: "example", title: "Board", queryHandlerId: "query" }],
  );
  const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("board")!;
  const first = await renderer.executeQuery(queryState, new AbortController().signal);
  if (!("getSnapshot" in renderer.attributes)) throw new Error("Expected live attributes");
  const attributes = renderer.attributes.getSnapshot();
  let changes = 0;
  const stop = renderer.attributes.subscribe(() => {
    changes += 1;
  });
  title = "Changed";
  const next = await renderer.executeQuery(queryState, new AbortController().signal);
  expect(next[0]).not.toBe(first[0]);
  expect(next[1]).toBe(first[1]);
  expect(renderer.attributes.getSnapshot()).toBe(attributes);
  expect(changes).toBe(0);
  stop();
});
