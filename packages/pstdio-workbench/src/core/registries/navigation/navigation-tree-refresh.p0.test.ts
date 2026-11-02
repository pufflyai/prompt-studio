import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { createNavigationTreeRegistry } from "./navigation-tree-registry";

test("refreshing a contributed view invalidates composed navigation until the contribution is disposed", async () => {
  const workbench = createWorkbench();
  const owner = { kind: "page", id: "ticket", extensionId: "planner" } as const;
  let files = [{ id: "first", label: "first.md" }];
  workbench.views.registerView({
    id: "files",
    title: "Files",
    body: {
      kind: "tree",
      getBody: () => [{ id: "files", nodes: files }],
      getChildren: () => [],
    },
  });
  const contribution = workbench.navigationTrees.registerContribution({
    id: "ticket-files",
    owner,
    sourceExtensionId: "planner",
    declarationIndex: 0,
    viewId: "files",
  });
  let refreshes = 0;
  workbench.navigationTrees.onDidChange(() => refreshes++);
  files = [...files, { id: "second", label: "second.md" }];
  workbench.views.refreshView("files");
  expect(refreshes).toBe(1);
  expect((await workbench.navigationTrees.getSections(owner))[0]?.nodes).toHaveLength(2);
  contribution.dispose();
  refreshes = 0;
  workbench.views.refreshView("files");
  expect(refreshes).toBe(0);
});

test("the registration revision changes when contributions register or leave, not when a view refreshes", () => {
  let refreshView = () => {};
  const registry = createNavigationTreeRegistry({
    subscribeViewRefresh: (_viewId, listener) => {
      refreshView = listener;
      return { dispose: () => {} };
    },
  });
  const initial = registry.getRegistrationRevision();
  const registration = registry.registerContribution({
    id: "notes",
    owner: { kind: "mode", id: "project", extensionId: "pstdio" },
    sourceExtensionId: "notes",
    declarationIndex: 0,
    viewId: "notes.tree",
  });
  const registered = registry.getRegistrationRevision();
  refreshView();
  expect(registry.getRegistrationRevision()).toBe(registered);
  registration.dispose();

  expect(registered).not.toBe(initial);
  expect(registry.getRegistrationRevision()).not.toBe(registered);
});
