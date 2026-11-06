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
  for (const page of Object.values(workspacePages))
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
      main: {
        kind: "view",
        view: page === workspacePages.list ? workspaceViews.list : workspaceViews.file,
        cardinality: "one",
      },
      slots: [],
    });
  return views;
};
