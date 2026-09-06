import { createElement } from "react";
import { getWorkbenchRenderers, type WorkbenchCore } from "../../../core";
import { WorkbenchDataTableView } from "./data-table-view";

const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchDataTableRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  getWorkbenchRenderers(workbench).setDataTableRendererImplementation(
    ({ workbench: scope, instance, dataTableRendererId }) => {
      const contribution = getWorkbenchRenderers(scope).getDataTableRenderer(dataTableRendererId);
      if (!contribution) return null;
      return createElement(WorkbenchDataTableView, { workbench: scope, contribution, placement: instance });
    },
  );
};
