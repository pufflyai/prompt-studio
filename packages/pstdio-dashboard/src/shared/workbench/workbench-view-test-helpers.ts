import type { ResourceRef, WorkbenchCore } from "@pstdio/workbench";

const viewBody = (workbench: WorkbenchCore, viewId: string) => {
  const body = workbench.views.getView(viewId)?.body;
  if (!body) throw new Error(`View is not registered: ${viewId}`);
  return body;
};

export const treeViewBody = (workbench: WorkbenchCore, viewId: string) => {
  const body = viewBody(workbench, viewId);
  if (body.kind !== "tree") throw new Error(`View is not a tree: ${viewId}`);
  return body;
};

export const treeViewSections = (
  workbench: WorkbenchCore,
  viewId: string,
  input: { filter?: string; resource?: ResourceRef } = {},
) =>
  treeViewBody(workbench, viewId).getBody({
    ...input,
    viewId,
    state: workbench.treeViews.getTreeState(viewId),
    refresh: () => workbench.views.refreshView(viewId),
    setSelectedNode: (nodeId) => workbench.treeViews.setSelectedNode(viewId, nodeId),
  });

export const fileViewBody = (workbench: WorkbenchCore, viewId: string) => {
  const body = viewBody(workbench, viewId);
  if (body.kind !== "file") throw new Error(`View is not a file: ${viewId}`);
  return body;
};

export const dataTableViewBody = (workbench: WorkbenchCore, viewId: string) => {
  const body = viewBody(workbench, viewId);
  if (body.kind !== "dataTable") throw new Error(`View is not a data table: ${viewId}`);
  return body;
};
