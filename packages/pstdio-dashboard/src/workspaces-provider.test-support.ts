import { contributionRefId, workspacePages, workspaceViews } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";
/** Core composition tests supply provider declarations; installed UI is exercised by extension E2E. */
export const registerWorkspaceProviderViews = (workbench: WorkbenchCore) => {
  const views = Object.values(workspaceViews).map((view) =>
    workbench.views.registerView({
      id: contributionRefId(view),
      title: view.id,
      body: { kind: "react" as const, render: () => null },
    }),
  );
  const pages = Object.values(workspacePages).map((page) =>
    workbench.pages.registerPage({
      id: contributionRefId(page),
      ref: page,
      path: page.id,
      modeId: "project",
      ...(page === workspacePages.list
        ? {}
        : {
            parentId: contributionRefId(workspacePages.list),
            resource: { kinds: [{ kind: "resource-kind" as const, id: "workspace" }] },
          }),
      ...(page === workspacePages.list ? {} : { document: { metadataKey: "workspaceFilePath" } }),
      main:
        page === workspacePages.workspace
          ? { kind: "panels", landing: "files", empty: workspaceViews.summary }
          : {
              kind: "view",
              view:
                { workspaces: workspaceViews.list, history: workspaceViews.history, overview: workspaceViews.summary }[
                  page.id
                ] ?? workspaceViews.file,
              cardinality: "one",
              presentation: page === workspacePages.list ? "tabs" : "page",
            },
      slots:
        page === workspacePages.workspace
          ? [
              { id: "files", region: "main", item: { kind: "view", view: workspaceViews.file, presence: "open" } },
              { id: "changes", region: "main", item: { kind: "view", view: workspaceViews.changes, presence: "open" } },
            ]
          : [],
    }),
  );
  return [...views, ...pages];
};
