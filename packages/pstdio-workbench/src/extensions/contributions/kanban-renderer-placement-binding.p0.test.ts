import { expect, test } from "bun:test";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { createWorkbench, getWorkbenchRenderers, type ResourceRef } from "../../core";
import { bindKanbanRendererContribution } from "../../core/registries/renderers/kanban-renderer-binding";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";
import { queryState } from "./kanban-renderer-query.fixture";

const routed = { type: "session", id: "conversation" };
const record = {
  id: "history",
  extensionId: "example.workspaces",
  title: "Session history",
  queryHandlerId: "query",
  moveHandlerId: "move",
  attributeChangeHandlerId: "change",
  columnActionHandlerId: "column",
  createRow: { commandId: "create", title: "New" },
  attributes: [],
} satisfies WorkbenchExtensionKanbanRendererRecord;

const setup = (respond: (commandId: string, resource: ResourceRef | undefined) => unknown = () => []) => {
  const workbench = createWorkbench();
  workbench.getPrimaryResource = () => routed;
  const calls: { commandId: string; resource: unknown; renderer: unknown }[] = [];
  registerWorkbenchExtensionKanbanRenderers(
    {
      projectId: "project",
      workbench,
      executeCommand: async (commandId, input) => {
        const renderer = (input.params?.renderer as { resource?: unknown } | undefined)?.resource;
        calls.push({ commandId, resource: input.resource, renderer });
        return respond(commandId, input.resource as ResourceRef | undefined);
      },
    },
    [record],
  );
  const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("history")!;
  return { workbench, calls, renderer };
};

test("a board bound to a Side placement reads and writes its own resource, not Main's", async () => {
  const { workbench, calls, renderer } = setup();
  const workspace = { type: "workspace", id: "laptop" };
  const side = bindKanbanRendererContribution(renderer, { instanceId: "side", resource: workspace });
  expect(bindKanbanRendererContribution(renderer, { instanceId: "side", resource: workspace })).toBe(side);
  const signal = new AbortController().signal;
  await side.executeQuery(queryState, signal);
  await side.onMove!({ rowId: "row", from: "a", to: "b" } as never);
  await side.onAttributeChange!("row", "status", "done");
  await side.onColumnAction!("a", "archive");
  await side.onCreateRow!({ values: { title: "New" }, attributeValues: {}, openCreatedRow: false } as never);
  expect(calls.map((call) => call.commandId)).toEqual(["query", "move", "change", "column", "create"]);
  for (const call of calls) expect(call).toMatchObject({ resource: workspace, renderer: workspace });
  // The unbound renderer still follows Main.
  calls.length = 0;
  await renderer.onMove!({ rowId: "row", from: "a", to: "b" } as never);
  expect(calls).toMatchObject([{ commandId: "move", resource: routed }]);
  await workbench.dispose();
});

test("two placements of one board keep their own query metadata and overlapping reads", async () => {
  const pending = new Map<string, PromiseWithResolvers<unknown>>();
  const { workbench, renderer } = setup((_commandId, resource) => {
    const deferred = Promise.withResolvers<unknown>();
    pending.set(resource!.id, deferred);
    return deferred.promise;
  });
  const first = bindKanbanRendererContribution(renderer, {
    instanceId: "main",
    resource: { type: "workspace", id: "a" },
  });
  const second = bindKanbanRendererContribution(renderer, {
    instanceId: "side",
    resource: { type: "workspace", id: "b" },
  });
  const signal = new AbortController().signal;
  const firstRead = first.executeQuery(queryState, signal);
  const secondRead = second.executeQuery(queryState, signal);
  const result = (id: string) => ({
    rows: [{ id: `${id}-row`, title: id, attributes: {} }],
    attributes: [{ id: `${id}-field`, label: id, type: { kind: "string" } }],
  });
  pending.get("b")!.resolve(result("b"));
  pending.get("a")!.resolve(result("a"));
  expect((await firstRead).map((row) => row.id)).toEqual(["a-row"]);
  expect((await secondRead).map((row) => row.id)).toEqual(["b-row"]);
  const fields = (contribution: typeof first) => {
    const source = contribution.attributes;
    const list = Array.isArray(source) ? source : source.getSnapshot();
    return list.map((attribute) => attribute.id);
  };
  expect(fields(first)).toEqual(["a-field"]);
  expect(fields(second)).toEqual(["b-field"]);
  await workbench.dispose();
});
