import { createElement } from "react";
import type { WorkbenchCore } from "../../../core";
import { WorkbenchDataTableView } from "./data-table-view";

const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchDataTableRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  workbench.renderers.setDataTableRendererImplementation(({ workbench: scope, placement, dataTableRendererId }) => {
    const contribution = scope.renderers.getDataTableRenderer(dataTableRendererId);
    if (!contribution) return null;
    return createElement(WorkbenchDataTableView, { workbench: scope, contribution, placement });
  });
};
