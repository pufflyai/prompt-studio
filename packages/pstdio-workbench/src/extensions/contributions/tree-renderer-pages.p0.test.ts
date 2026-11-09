import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";
import { metadata, treeId } from "./tree-renderer-contributions.fixture";

test("section and child pages retain their public parent, filter, resource and cancellation signal", async () => {
  const workbench = createWorkbench();
  const calls: Array<{ params?: Record<string, unknown>; signal?: AbortSignal }> = [];
  const folder = {
    id: "folder",
    label: "Sessions",
    children: [],
    nextCursor: "children",
    metadata: { workspaceId: "w" },
  };
  workbench.registerModule({
    id: "pages",
    activate: (context) =>
      registerWorkbenchExtensionTreeRenderers({
        workbench: context,
        projectId: "project-1",
        metadata: { ...metadata, treeRenderers: [{ ...metadata.treeRenderers[0]!, pageHandlerId: "page" }] },
        executeCommand: (id, body, signal) => {
          if (id !== "page") return [{ id: "history", nodes: [folder], nextCursor: "root" }];
          calls.push({ params: body.params, signal });
          return {
            nodes: [{ id: "older", label: "Older", resource: { type: "session", id: "older" } }],
            nextCursor: undefined,
          };
        },
      }),
  });
  const resource = { type: "workspace", id: "w" };
  const sections = await getWorkbenchRenderers(workbench).getBody(treeId, { resource, filter: "needle" });
  const controller = new AbortController();
  const page = await sections[0]!.nextPage!(controller.signal);
  const children = await sections[0]!.nodes[0]!.nextPage!(controller.signal);
  expect(page.nodes[0]!.id).toBe("older");
  expect(children.nextPage).toBeUndefined();
  expect(calls.map((call) => call.params)).toMatchObject([
    {
      cursor: "root",
      parent: { kind: "section", id: "history" },
      filter: "needle",
      renderer: { projectId: "project-1", resource },
    },
    {
      cursor: "children",
      parent: { kind: "node", node: folder },
      filter: "needle",
      renderer: { projectId: "project-1", resource },
    },
  ]);
  expect(calls.every((call) => call.signal === controller.signal)).toBe(true);
});

test("identical folder data after a filter change uses the current page query", async () => {
  const workbench = createWorkbench();
  const filters: unknown[] = [];
  workbench.registerModule({
    id: "filter-pages",
    activate: (context) =>
      registerWorkbenchExtensionTreeRenderers({
        workbench: context,
        projectId: "project-1",
        metadata: { ...metadata, treeRenderers: [{ ...metadata.treeRenderers[0]!, pageHandlerId: "page" }] },
        executeCommand: (id, body) => {
          if (id !== "page")
            return [{ id: "history", nodes: [{ id: "folder", label: "Sessions", children: [], nextCursor: "older" }] }];
          filters.push(body.params?.filter);
          return { nodes: [] };
        },
      }),
  });
  const trees = getWorkbenchRenderers(workbench);
  await trees.getBody(treeId, { filter: "old" });
  const current = await trees.getBody(treeId, { filter: "new" });
  await current[0]!.nodes[0]!.nextPage!(new AbortController().signal);
  expect(filters).toEqual(["new"]);
});
