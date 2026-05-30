import { createElement } from "react";
import type { WorkbenchCore } from "../../../core";
import { WorkbenchDataView } from "./data-view";

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchDataRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  workbench.renderers.setDataRendererImplementation(({ workbench: scope, placement, dataRendererId }) => {
    const contribution = scope.renderers.getDataRenderer(dataRendererId);
    if (!contribution) return null;
    return createElement(WorkbenchDataView, { workbench: scope, contribution, placement });
  });
};
