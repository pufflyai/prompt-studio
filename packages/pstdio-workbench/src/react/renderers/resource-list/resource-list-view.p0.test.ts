import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "../../../extensions/contributions/kanban-renderer-contributions";
import { queryState } from "../../../extensions/contributions/kanban-renderer-query.fixture";

test("resource lists register as native views and translate child resource navigation", async () => {
  const workbench = createWorkbench();
  const registration = registerWorkbenchExtensionKanbanRenderers(
    {
      workbench,
      projectId: "project",
      executeCommand: async () => ({
        rows: [
          {
            id: "parent",
            title: "Workspace",
            attributes: {},
            children: [
              {
                id: "child",
                title: "Session",
                attributes: {},
                target: {
                  kind: "page",
                  page: { kind: "page", id: "session" },
                  resource: { type: "session", id: "child" },
                },
              },
            ],
          },
        ],
      }),
    },
    [
      {
        kind: "resourceList",
        id: "resources",
        title: "Resources",
        extensionId: "example.resources",
        queryHandlerId: "query",
      },
    ],
  );
  expect(workbench.views.getView("resources")?.body.kind).toBe("resourceList");
  const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("resources")!;
  expect(renderer.presentation).toBe("resourceList");
  const rows = await renderer.executeQuery(queryState, new AbortController().signal);
  expect(rows[0].children?.[0].target).toMatchObject({
    page: { extensionId: "example.resources", id: "session" },
    resource: { projectId: "project", extensionId: "example.resources", id: "child" },
  });
  registration.dispose();
  expect(workbench.views.getView("resources")).toBeUndefined();
  expect(getWorkbenchRenderers(workbench).getKanbanRenderer("resources")).toBeUndefined();
});
