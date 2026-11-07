import type { PageRef, ResourceRef, ViewRef } from "@pstdio/sdk/extensions";
import { contributionRefId } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";

const extensionId = "pstdio.pstdio-workspaces";
const page = (id: string): PageRef => ({ kind: "page", extensionId, id });
const view = (id: string): ViewRef => ({ kind: "view", extensionId, id });
export const workspacePages = {
  create: page("create"),
  list: page("workspaces"),
  files: page("files"),
  workspace: page("workspace"),
  overview: page("overview"),
  history: page("history"),
  form: page("action"),
  device: page("device"),
};
export const workspaceViews = {
  list: view("workspaces"),
  file: view("file"),
  tree: view("file-tree"),
  changes: view("changes"),
  summary: view("summary"),
  history: view("history"),
};

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

export const openWorkspaceFixture = (workbench: WorkbenchCore, resource?: ResourceRef) => {
  const projectId = workbench.pages.store.getState().projectId ?? "project-1";
  workbench.pageLocations.setProject(projectId);
  return workbench.pageLocations.navigate({
    kind: "page",
    page: resource ? workspacePages.workspace : workspacePages.list,
    ...(resource ? { resource } : {}),
  });
};
