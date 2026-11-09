import { expect, test } from "bun:test";
import { createNavigationTreeRegistry } from "./navigation-tree-registry";

test("later Sidenav pages keep scoped IDs and provider ownership for child expansion", async () => {
  const owner = { kind: "page" as const, id: "sessions", extensionId: "history" };
  const queries: unknown[] = [];
  const registry = createNavigationTreeRegistry({
    getViewSections: () => [
      {
        id: "sessions",
        nodes: [],
        nextPage: async () => ({ nodes: [{ id: "older", label: "Older", collapsible: true }] }),
      },
    ],
    getViewChildren: (view, node, context) => {
      queries.push({ view, node, resource: context.resource });
      return [{ id: "child", label: "Child" }];
    },
  });
  registry.registerContribution({
    id: "history",
    idScope: "history",
    owner,
    sourceExtensionId: "history",
    declarationIndex: 0,
    viewId: "history-view",
  });
  const resource = { type: "workspace", id: "w" };
  const sections = await registry.getSections(owner, "content", { resource });
  const page = await sections[0]!.nextPage!(new AbortController().signal);
  expect(page.nodes[0]!.id).toBe("history:older");
  const children = await registry.getChildren(page.nodes[0]!);
  expect(children[0]!.id).toBe("history:child");
  expect(queries).toEqual([
    { view: "history-view", node: { id: "older", label: "Older", collapsible: true }, resource },
  ]);
});
