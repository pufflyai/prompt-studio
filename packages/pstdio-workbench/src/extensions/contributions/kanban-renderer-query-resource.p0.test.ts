import { expect, test } from "bun:test";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { createWorkbench, getWorkbenchRenderers, type KanbanRendererQueryState } from "../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";

const state: KanbanRendererQueryState = {
  settings: { viewMode: "list", columnGrouping: "none", rowGrouping: "none", displayProperties: [] },
  filter: { conjunction: "and", rules: [] },
  sorts: [],
};

test("a board queries its own placement's resource, not the resource routed in Main", async () => {
  const workbench = createWorkbench();
  const routed = { type: "session", id: "conversation" };
  const placed = { type: "workspace", id: "laptop" };
  workbench.getPrimaryResource = () => routed;
  const sent: unknown[] = [];
  registerWorkbenchExtensionKanbanRenderers(
    {
      projectId: "project-1",
      workbench,
      executeCommand: async (_commandId, input) => {
        sent.push({ resource: input.resource, renderer: (input.params?.renderer as { resource?: unknown })?.resource });
        return [];
      },
    },
    [
      {
        id: "history",
        extensionId: "example.workspaces",
        title: "Session history",
        queryHandlerId: "history.query",
        attributes: [],
      } satisfies WorkbenchExtensionKanbanRendererRecord,
    ],
  );
  const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("history")!;
  await renderer.executeQuery({ ...state, resource: placed }, new AbortController().signal);
  // A board without a bound resource still follows Main.
  await renderer.executeQuery(state, new AbortController().signal);
  expect(sent).toEqual([
    { resource: placed, renderer: placed },
    { resource: routed, renderer: routed },
  ]);
  await workbench.dispose();
});
