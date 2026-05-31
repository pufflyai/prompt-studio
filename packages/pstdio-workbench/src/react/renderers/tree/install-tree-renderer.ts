import { createElement } from "react";
import type { WorkbenchCore } from "../../../core";
import { WorkbenchTreeView } from "./tree-view";

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchTreeRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  workbench.renderers.setTreeRendererImplementation(({ workbench: scope, placement, treeId }) =>
    createElement(WorkbenchTreeView, {
      workbench: scope,
      treeViewId: treeId,
      resource: placement.resource,
    }),
  );
};
