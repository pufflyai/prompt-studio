import { expect, test } from "bun:test";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { bindKanbanRendererContribution } from "../../../core/registries/renderers/kanban-renderer-binding";
import { registerWorkbenchExtensionKanbanRenderers } from "../../../extensions/contributions/kanban-renderer-contributions";
import { queryState } from "../../../extensions/contributions/kanban-renderer-query.fixture";
import { renderWorkbenchResourceList } from "./install-resource-list-renderer";

test("a resource list keeps its bound placement and query-supplied columns across re-renders", async () => {
  const workbench = createWorkbench();
  let queries = 0;
  registerWorkbenchExtensionKanbanRenderers(
    {
      projectId: "project",
      workbench,
      executeCommand: async () => {
        queries++;
        // Session history declares no columns up front; its query supplies them.
        return {
          rows: [{ id: "session", title: "Remote conversation", attributes: { status: "running" } }],
          attributes: [{ id: "status", label: "Status", type: { kind: "string" } }],
        };
      },
    },
    [
      {
        id: "history",
        extensionId: "example.workspaces",
        title: "Session history",
        kind: "resourceList",
        queryHandlerId: "query",
        attributes: [],
      } satisfies WorkbenchExtensionKanbanRendererRecord,
    ],
  );
  const registered = getWorkbenchRenderers(workbench).getKanbanRenderer("history")!;
  const placement = {
    instanceId: "side-history",
    panelId: "history",
    closable: false,
    resource: { type: "workspace", id: "laptop" },
  };
  const binding = { instanceId: placement.instanceId, resource: placement.resource };
  // Each parent render calls the wrapper again; the view binds what it receives.
  const render = () =>
    renderWorkbenchResourceList({ workbench, contribution: registered, placement } as Parameters<
      typeof renderWorkbenchResourceList
    >[0]).props.contribution;
  const bound = bindKanbanRendererContribution(render(), binding);
  const rows = await bound.executeQuery(queryState, new AbortController().signal);
  expect(rows.map((row) => row.id)).toEqual(["session"]);
  const columns = (contribution: typeof bound) => {
    const source = contribution.attributes;
    return (Array.isArray(source) ? source : source.getSnapshot()).map((attribute) => attribute.id);
  };
  expect(columns(bound)).toEqual(["status"]);
  const rerendered = bindKanbanRendererContribution(render(), binding);
  expect(rerendered).toBe(bound);
  expect(columns(rerendered)).toEqual(["status"]);
  // Any wrapper that copies the contribution reuses the same placement body.
  const copied = bindKanbanRendererContribution({ ...registered }, binding);
  expect(copied.attributes).toBe(bound.attributes);
  expect(copied.onRowActivate).toBe(bound.onRowActivate);
  expect(columns(copied)).toEqual(["status"]);
  expect(queries).toBe(1);
  await workbench.dispose();
});
