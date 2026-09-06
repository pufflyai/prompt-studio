import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

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
