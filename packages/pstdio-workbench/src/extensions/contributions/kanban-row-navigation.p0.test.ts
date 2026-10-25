import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";
import { queryState } from "./kanban-renderer-query.fixture";

test("row queries supply a complete navigation target without an activation callback", async () => {
  const workbench = createWorkbench();
  let calls = 0;
  registerWorkbenchExtensionKanbanRenderers(
    {
      workbench,
      projectId: "project-1",
      executeCommand: async () => {
        calls++;
        return {
          rows: [
            {
              id: "ticket-1",
              title: "Ticket",
              attributes: {},
              target: {
                kind: "page",
                page: { kind: "page", id: "requests" },
                resource: { type: "ticket", id: "ticket-1" },
                parent: { kind: "page", page: { kind: "page", id: "ticket" } },
              },
            },
          ],
        };
      },
    },
    [{ id: "tickets", extensionId: "example.planner", title: "Tickets", queryHandlerId: "query" }],
  );
  const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("tickets")!;
  const rows = await renderer.executeQuery(queryState, new AbortController().signal);
  expect(rows[0]?.target).toMatchObject({
    kind: "page",
    page: { id: "requests", extensionId: "example.planner" },
    resource: { type: "ticket", id: "ticket-1", extensionId: "example.planner", projectId: "project-1" },
    parent: { kind: "page", page: { id: "ticket", extensionId: "example.planner" } },
  });
  expect(renderer.onRowActivate).toBeUndefined();
  expect(calls).toBe(1);
});
